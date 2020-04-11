/*:
@plugindesc バトルをATBに変更します。
@author うなぎおおとろ(twitter https://twitter.com/unagiootoro8388)

@param useCTB
@type boolean
@default false
@desc
trueを指定すると、CTBに切り替えます。

@param waitSelectSkillOrItem
@type boolean
@default true
@desc
trueを指定すると、スキルまたはアイテム選択中はゲージの進行を停止します。

@param waitAnimation
@type boolean
@default true
@desc
trueを指定すると、アニメーション再生中はゲージの進行を停止します。

@param drawEnemyUnderGauge
@type boolean
@default true
@desc
trueを指定すると、エネミーにもゲージを表示します。

@param baseGaugeSpeed
@type number
@default 5
@desc
ゲージが溜まる速さを指定します。値が大きくなるほど早くなります。

@param maxActionCount
@type number
@default 3
@desc
1ターンで行動可能な行動回数の最大値を指定します。

@param baseSkillWaitGaugeSpeed
@type number
@default 3
@desc
スキル発動待機時のゲージが溜まる速さを指定します。値が大きくなるほど早くなります。

@param fastForward
@type number
@default 2
@desc
Shiftキーが押されている間、ゲージ進行を早送りするスピードを設定します。

@param enableYEP_BattleEngineCore
@type boolean
@default false
@desc
YEP_BattleEngineCoreとの競合を解決します。
このパラメータはCTBモードのときのみ有効です。

@help
【メモ欄で設定可能な項目】
スキルのメモ欄に
<SkillWait>
と記載すると、スキル発動までキャラクターを待機させます。

ステートのメモ欄に
<ReduceGauge value=減少値>
と記載すると、ステート付与時にゲージを減少値だけ減少させます。
減少値は1～1000の間で指定してください。

ステートのメモ欄に
<Quick>
と記載すると、ステートが付与されている間は、常にゲージが最大になります。

【仕様】
・内部的にはゲージの値は0～1000で管理され、毎フレームごとに増加します。
・ゲージが溜まる速さは次の計算式で決定します。
　　ゲージスピード = (素早さ / 全キャラクターの素早さの最小値) * baseGaugeSpeed * fastForward
・スキル待機時間は次の計算式で決定します。
　　スキル待機時間 = (ゲージスピード + スキルの速度補正 + 攻撃速度補正) * baseSkillWaitGaugeSpeed
・戦闘における1ターンの経過は、全キャラクターの行動が終わった段階で1ターン経過とみなします。
・ステートの自動解除のタイミングを「行動終了時」にした場合、ターンではなく、
キャラクターが行動した回数が継続ターン数に達したときにステートが解除されます。
・Shiftキーを押すと、ゲージが溜まるのを早送りすることができます。

【ライセンス】
このプラグインは、MITライセンスの条件の下で利用可能です。

【更新履歴】
v1.1.0 アクターウィンドウでキャンセルするとパーティウィンドウに遷移するように変更
       CTBモード時、「YEP_BattleEngineCore.js」との競合に対応
       バグ修正
v1.0.4 ATBが動かない不具合を修正
v1.0.3 アクションが実行できなかった時にゲージがクリアされないバグを修正
v1.0.2 外部からコンフィグを変更できるように修正
v1.0.1 ターン終了時にSkillWaitのゲージ速度が変更されるバグを修正
v1.0.0 新規作成
*/

const ATBConfig = {};

{
    "use strict";

    const param = PluginManager.parameters("ATB");
    ATBConfig.useCTB = (param["useCTB"] === "true" ? true : false);
    ATBConfig.waitSelectSkillOrItem = (param["waitSelectSkillOrItem"] === "true" ? true : false);
    ATBConfig.waitAnimation = (param["waitAnimation"] === "true" ? true : false);
    ATBConfig.drawEnemyUnderGauge = (param["drawEnemyUnderGauge"] === "true" ? true : false);
    ATBConfig.baseGaugeSpeed = parseInt(param["baseGaugeSpeed"]);
    ATBConfig.maxActionCount = parseInt(param["maxActionCount"]);
    ATBConfig.baseSkillWaitGaugeSpeed = parseInt(param["baseSkillWaitGaugeSpeed"]);
    ATBConfig.fastForward = parseInt(param["fastForward"]);
    ATBConfig.enableYEP_BattleEngineCore = (param["enableYEP_BattleEngineCore"] === "true" ? true : false);
    ATBConfig.drawUnderGauge = false;

    class ATBGauge {
        static get PURPOSE_TIME() {
            return "PURPOSE_TIME";
        }

        static get PURPOSE_SKILL_WAIT() {
            return "PURPOSE_SKILL_WAIT";
        }

        constructor(battler) {
            this._battler = battler;
            this._speed = 1;
            this._value = 0;
            this._purpose = ATBGauge.PURPOSE_TIME;
            this._stop = false;
            this._clearWait = false;
            this._quick = false;
            battler.setGauge(this);
        }

        set purpose(_purpose) {
            this._purpose = _purpose;
        }

        get purpose() {
            return this._purpose;
        }

        set value(_value) {
            this._value = _value;
            if (this._value > ATBManager.GAUGE_MAX) this._value = ATBManager.GAUGE_MAX;
            if (this._value < 0) this._value = 0;
        }

        get value() {
            return this._value;
        }

        battler() {
            return this._battler;
        }

        changeSpeed(speed) {
            if (speed > ATBConfig.maxActionCount) speed = ATBConfig.maxActionCount;
            this._speed = speed;
        }

        toFull() {
            this._value = ATBManager.GAUGE_MAX;
        }

        isFull() {
            if (this._stop) return false;
            if (this._clearWait) return false;
            return this._value === ATBManager.GAUGE_MAX;
        }

        increment(fastForwardSpeed = 1) {
            if (this._stop) return;
            if (this._clearWait) return;
            if (this._battler.isDead()) return;
            if (!this._battler.canMove()) return;
            if (this._quick) {
                this.toFull();
                return;
            }
            this._value += this._speed * ATBConfig.baseGaugeSpeed * fastForwardSpeed;
            if (this._value > ATBManager.GAUGE_MAX) this.toFull();
        }

        clearWait() {
            this._clearWait = true;
        }

        clear() {
            this._value = 0;
            this._clearWait = false;
        }

        stop() {
            this._stop = true;
        }

        resume() {
            this._stop = false;
        }

        isStop() {
            return this._stop === true;
        }

        isActionEnd() {
            return !this._clearWait;
        }

        startQuick() {
            this._quick = true;
        }

        endQuick() {
            this._quick = false;
        }
    }


    class ATBManager {
        static get GAUGE_MAX() {
            return 1000;
        }

        constructor() {
            this._holdAllBattleMembers = [];
            this._endActionBattlers = [];
            this._canActionMembers = [];
            this._gauges = [];
            this._wait = {};
        }

        startBattle() {
            this.createGauges();
        }

        startTurn() {
            this.createGauges();
            this.makeSpeed();
        }

        updateTurn() {
            if (!ATBConfig.useCTB) this.priorityEnemyAction();
            for (let gauge of this._gauges) {
                if (gauge.battler().isDead()) gauge.value = 0;
                if (gauge.isFull()) {
                    if (gauge.purpose === ATBGauge.PURPOSE_TIME) gauge.battler().makeActions();
                    this._canActionMembers.push(gauge.battler());
                    gauge.clearWait();
                }
            }
        }

        priorityEnemyAction() {
            const actors = [];
            const enemies = [];
            for (let battler of this._canActionMembers) {
                if (battler instanceof Game_Actor) {
                    actors.push(battler);
                } else {
                    enemies.push(battler);
                }
            }
            this._canActionMembers = enemies.concat(actors);
        }

        updateGauge() {
            if (!this.isActive()) return;
            for (let gauge of this._gauges) {
                gauge.increment(this.fastForwardSpeed());
            }
            BattleManager.refreshStatus();
        }

        fastForwardSpeed() {
            if (Input.isPressed("shift")) return ATBConfig.fastForward;
            return 1;
        }

        endTurn() {
            this._endActionBattlers = [];
        }

        toActive(factor) {
            this._wait[factor] = false;
        }

        toWait(factor) {
            this._wait[factor] = true;
        }

        isActive() {
            for (let factor in this._wait) {
                if (this._wait[factor]) return false;
            }
            return true;
        }

        createGauges() {
            const members = BattleManager.allBattleMembers();
            for (let battler of members) {
                if (this._holdAllBattleMembers.indexOf(battler) === -1) {
                    this._holdAllBattleMembers.push(battler);
                    this._gauges.push(new ATBGauge(battler));
                }
            }
            for (let battler of this._holdAllBattleMembers) {
                if (members.indexOf(battler) === -1) {
                    let i = this._holdAllBattleMembers.indexOf(battler);
                    this._holdAllBattleMembers.splice(i, 1);
                    i = this._gauges.indexOf(battler.gauge())
                    this._gauges.splice(i, 1);
                }
            }
        }

        endAction(battler) {
            battler.gauge().clear();
            if (this._endActionBattlers.indexOf(battler) === -1) {
                this._endActionBattlers.push(battler);
            }
            if (battler.gauge().purpose === ATBGauge.PURPOSE_SKILL_WAIT) {
                this.skillWaitEnd(battler);
            }
        }

        resetGaugeSpeed(battler, speed = battler.speed()) {
            let speeds = [];
            for (let gauge of this._gauges) {
                speeds.push(gauge.battler().speed());
            }
            const minSpeed = Math.min(...speeds);
            const gaugeSpeed = speed / minSpeed;
            battler.gauge().changeSpeed(gaugeSpeed);
        }

        makeSpeed() {
            let speeds = [];
            for (let gauge of this._gauges) {
                gauge.battler().makeSpeed();
                speeds.push(gauge.battler().speed());
            }
            const minSpeed = Math.min(...speeds);
            let i = 0;
            for (let gauge of this._gauges) {
                if (gauge.purpose === ATBGauge.PURPOSE_TIME) {
                    let gaugeSpeed = speeds[i] / minSpeed;
                    gauge.changeSpeed(gaugeSpeed);
                }
                i++;
            }
        }

        isEndTurn() {
            let numAllCanMoveMembers = 0;
            for (let battler of BattleManager.allBattleMembers()) {
                if (battler.isAlive() && battler.canMove() ) numAllCanMoveMembers++;
            }
            if (this._endActionBattlers.length === numAllCanMoveMembers) {
                return true;
            }
            return false;
        }

        skillWaitStart(battler) {
            battler.gauge().clear();
            const action = battler.currentAction();
            let skillWaitSpeed = (battler.speed() + action.item().speed);
            if (battler.currentAction().isAttack()) skillWaitSpeed += battler.attackSpeed();
            this.resetGaugeSpeed(battler, skillWaitSpeed * ATBConfig.baseSkillWaitGaugeSpeed);
            battler.gauge().purpose = ATBGauge.PURPOSE_SKILL_WAIT;
        }

        skillWaitEnd(battler) {
            battler.gauge().clear();
            this.resetGaugeSpeed(battler);
            battler.gauge().purpose = ATBGauge.PURPOSE_TIME;
        }

        getNextSubject() {
            for (let i = 0; i < this._canActionMembers.length; i++) {
                let subject = this._canActionMembers[i];
                if (!subject.gauge().isStop()) {
                    this._canActionMembers.splice(i, 1);
                    return subject;
                }
            }
            return null;
        }

        getNextEnemySubject() {
            for (let i = 0; i < this._canActionMembers.length; i++) {
                let subject = this._canActionMembers[i];
                if (!(subject instanceof Game_Actor)) {
                    this._canActionMembers.splice(i, 1);
                    return subject;
                }
            }
            return null;
        }

        addNextSubject(subject) {
            this._canActionMembers.unshift(subject);
        }

        escapeFailed() {
            this._endActionBattlers = [];
            this._canActionMembers = [];
            for (let actor of $gameParty.members()) {
                actor.gauge().clear();
            }
            for (let enemy of $gameTroop.members()) {
                enemy.gauge().toFull();
            }
        }

        surprise() {
            for (let gauge of this._gauges) {
                if (!(gauge.battler() instanceof Game_Enemy)) continue;
                gauge.toFull();
            }
        }

        preemptive() {
            for (let gauge of this._gauges) {
                if (!(gauge.battler() instanceof Game_Actor)) continue;
                gauge.toFull();
            }
        }

        addStateApply(battler, stateId) {
            const state = $dataStates[stateId];
            this.applyReduceGaugeState(battler, state);
            this.startQuickState(battler, state);
        }

        eraseStateApply(battler, stateId) {
            const state = $dataStates[stateId];
            this.endQuickState(battler, state);
        }

        applyReduceGaugeState(battler, state) {
            let matchData;
            if (state._reduceGauge === undefined) {
                if (matchData = state.note.match(/<\s*ReduceGauge\s+value=(\d+)\s*>/)) {
                    state._reduceGauge = parseInt(matchData[1]);
                } else {
                    state._reduceGauge = null;
                }
            }
            if (state._reduceGauge) battler.gauge().value -= state._reduceGauge;
        }

        startQuickState(targetBattler, state) {
            if (state._quick === undefined) {
                if (state.note.match(/<\s*Quick\s*>/)) {
                    state._quick = true;
                } else {
                    state._quick = false;
                }
            }
            if (state._quick) {
                for (let battler of BattleManager.allBattleMembers()) {
                    if (battler === targetBattler) {
                        battler.gauge().startQuick();
                    } else {
                        battler.gauge().stop();
                    }
                }
            }
        }

        endQuickState(targetBattler, state) {
            if (state._quick) {
                for (let battler of BattleManager.allBattleMembers()) {
                    if (battler === targetBattler) {
                        battler.gauge().endQuick();
                    } else {
                        battler.gauge().resume();
                    }
                }
            }
        }
    }


    /* class Game_BattlerBase */
    const _Game_BattlerBase_clearStates = Game_BattlerBase.prototype.clearStates;
    Game_BattlerBase.prototype.clearStates = function() {
        if (SceneManager._scene instanceof Scene_Battle) {
            for (let stateId of this._states) {
                BattleManager.eraseStateApply(this, stateId);
            }
        }
        _Game_BattlerBase_clearStates.call(this);
    };

    const _Game_BattlerBase_addNewState = Game_BattlerBase.prototype.addNewState;
    Game_BattlerBase.prototype.addNewState = function(stateId) {
        _Game_BattlerBase_addNewState.call(this, stateId);
        if (SceneManager._scene instanceof Scene_Battle) {
            BattleManager.addStateApply(this, stateId);
        }
    };

    const _Game_BattlerBase_eraseState = Game_BattlerBase.prototype.eraseState;
    Game_BattlerBase.prototype.eraseState = function(stateId) {
        _Game_BattlerBase_eraseState.call(this, stateId);
        if (SceneManager._scene instanceof Scene_Battle) {
            BattleManager.eraseStateApply(this, stateId);
        }
    };

    // timing 1: 行動終了時
    // timing 2: ターン終了時
    Game_BattlerBase.prototype.updateStateTurns = function(timing = 2) {
        for (let stateId of this._states) {
            if (this._stateTurns[stateId] > 0) {
                let state = $dataStates[stateId];
                if (state.autoRemovalTiming === timing) this._stateTurns[stateId]--;
            }
        }
    };


    /* class Game_Battler */
    const _Game_Battler_initMembers = Game_Battler.prototype.initMembers;
    Game_Battler.prototype.initMembers = function() {
        _Game_Battler_initMembers.call(this);
        this._gauge = null;
    };

    Game_Battler.prototype.getSprite = function() {
        const actorSprites = BattleManager._spriteset._actorSprites;
        const enemySprites = BattleManager._spriteset._enemySprites;
        const battlerSprites = actorSprites.concat(enemySprites);
        for (let sprite of battlerSprites) {
            if (sprite._battler === this) return sprite;
        }
        return null;
    };

    Game_Battler.prototype.setGauge = function(gauge) {
        return this._gauge = gauge;
    };

    Game_Battler.prototype.gauge = function() {
        return this._gauge;
    };

    // 行動終了時のステート解除判定後にステート経過ターンを更新する
    const _Game_Battler_onAllActionsEnd = Game_Battler.prototype.onAllActionsEnd;
    Game_Battler.prototype.onAllActionsEnd = function() {
        _Game_Battler_onAllActionsEnd.call(this);
        this.updateStateTurns(1);
    };

    // 行動完了時にdoneさせない
    Game_Battler.prototype.performActionEnd = function() {
        this.setActionState("undecided");
    };

    // speedの生成にactionを用いない
    Game_Battler.prototype.makeSpeed = function() {
        this._speed = this.agi + Math.randomInt(Math.floor(5 + this.agi / 4));
        this._speed += this.attackSpeed();
    };


    /* class Game_Actor */
    const _Game_BattlerBase_die = Game_BattlerBase.prototype.die;
    Game_Actor.prototype.die = function() {
        BattleManager.actorCommandSelectCancel(this);
        _Game_BattlerBase_die.call(this);
    };


    /* class Game_Item */
    Game_Item.prototype.isSkillWait = function() {
        const skill = this.object();
        if (!skill) return null;
        if (skill._skillWait === undefined) {
            if (skill.note.match(/<\s*SkillWait\s*>/)) {
                skill._skillWait = true;
            } else {
                skill._skillWait = false;
            }
        }
        return skill._skillWait;
    }


    /* class Game_Action */
    Game_Action.prototype.isSkillWait = function() {
        return this._item.isSkillWait();
    };


    /* singleton class BattleManager */
    const _BattleManager_initMembers = BattleManager.initMembers;
    BattleManager.initMembers = function() {
        _BattleManager_initMembers.call(this);
        this._actorCommandSelected = false;
        this._turnStarted = false;
        this._beforeActionFinish = false;
        this._turnStartReserve = false;
        this._actorCommandSelecting = false;
        this._atbManager = new ATBManager();
    };

    BattleManager.startInputPhase = function() {
        this._phase = "input";
    };

    BattleManager.setActor = function(actor) {
        this._actorIndex = $gameParty.members().indexOf(actor)
    };

    BattleManager.setActorCommandSelected = function(actorCommandSelected) {
        this._actorCommandSelected = actorCommandSelected;
    };

    BattleManager.isActorCommandSelected = function() {
        return this._actorCommandSelected;
    };

    BattleManager.isActorCommandSelecting = function() {
        return this._actorCommandSelecting;
    };

    BattleManager.setActorCommandSelecting = function(actorCommandSelecting) {
        this._actorCommandSelecting = actorCommandSelecting;
    };

    BattleManager.actorCommandSelectCancel = function(actor) {
        if (this.actor() === actor) {
            this._actorCommandSelected = false;
            this._actorCommandSelecting = false;
        }
    }

    const _BattleManager_startBattle = BattleManager.startBattle;
    BattleManager.startBattle = function() {
        _BattleManager_startBattle.call(this);
        this._atbManager.startBattle();
        if (this._surprise) {
            this._atbManager.surprise();
        } else if (this._preemptive) {
            this._atbManager.preemptive();
        }
        this._spriteset.createGaugeLines();
    };

    // startInput時にアクションの生成を行わない
    BattleManager.startInput = function() {
        this._phase = "input";
        this.clearActor();
        if (!$gameParty.canInput()) {
            this.startTurn();
        }
    };

    const _BattleManager_startTurn = BattleManager.startTurn;
    BattleManager.startTurn = function() {
        if (this._turnStarted) {
            this._phase = "turn";
            this.clearActor();
            this._logWindow.startTurn();
        } else {
            if (ATBConfig.enableYEP_BattleEngineCore) {
                this._enteredEndPhase = false;
                this._phase = "turn";
                this.clearActor();
                $gameTroop.increaseTurn();
                $gameParty.onTurnStart();
                $gameTroop.onTurnStart();
                this._performedBattlers = [];
                this.makeActionOrders();
                $gameParty.requestMotionRefresh();
                this._logWindow.startTurn();
            } else {
                _BattleManager_startTurn.call(this);
            }
            this._atbManager.toActive("turn");
            this._atbManager.startTurn();
            this._turnStarted = true;
        }
    };

    BattleManager.updateTurn = function() {
        // CTBの場合は、BattleManager.updateTurn内でゲージを更新する
        if (ATBConfig.useCTB) {
            this._atbManager.updateGauge();
        }
        this._atbManager.updateTurn();
        $gameParty.requestMotionRefresh();
        if (!this._subject) {
            this._subject = this.getNextSubject();
        }
        if (this._subject) {
            if (!ATBConfig.useCTB && this._subject instanceof Game_Actor) {
                const nextEnemySubject = this._atbManager.getNextEnemySubject();
                if (nextEnemySubject) {
                    this._atbManager.addNextSubject(this._subject);
                    this._subject = nextEnemySubject;
                }
            }
            this.processTurn();
        }
        if (this._phase === "turn" && this._atbManager.isEndTurn()) {
            this._atbManager.endTurn();
            this.endTurn();
        }
    };

    BattleManager.beforeAction = function(action) {
        const gauge = this._subject.gauge();
        if (gauge.purpose === ATBGauge.PURPOSE_SKILL_WAIT) {
            this.setActorCommandSelected(true);
            this._beforeActionFinish = true;
        } else if (this._subject instanceof Game_Actor && !this._actorCommandSelected) {
            if (!(this._subject.isConfused() && !action._forcing)) {
                this.setActor(this._subject);
                this.startInputPhase();
            } else {
                this.setActorCommandSelected(true);
            }
        } else if (action.isSkillWait()) {
            this._atbManager.skillWaitStart(this._subject);
            this._subject.setActionState("waiting");
        } else {
            this._beforeActionFinish = true;
        }
    };

    BattleManager.afterAction = function() {
        this._beforeActionFinish = false;
        this._atbManager.toActive("turn");
        if (this._subject instanceof Game_Actor) this.setActorCommandSelected(false);
    };

    BattleManager.processTurn = function() {
        const subject = this._subject;
        const action = subject.currentAction();
        if (action) {
            if (!this._beforeActionFinish) {
                this.beforeAction(action);
                if (this._beforeActionFinish) {
                    if (ATBConfig.useCTB && this._actorCommandSelected) this._atbManager.toWait("turn");
                }
            }
            if (this._beforeActionFinish) {
                action.prepare();
                if (action.isValid()) {
                    this.startAction();
                } else {
                    this._atbManager.endAction(this._subject);
                }
                subject.removeCurrentAction();
            } else if (this._subject.gauge().purpose === ATBGauge.PURPOSE_SKILL_WAIT) {
                this.afterAction();
                this._subject = this.getNextSubject();
            }
        } else {
            this.afterAction();
            subject.onAllActionsEnd();
            this.refreshStatus();
            this._logWindow.displayAutoAffectedStatus(subject);
            this._logWindow.displayCurrentState(subject);
            this._logWindow.displayRegeneration(subject);
            this._subject = this.getNextSubject();
        }
    };

    const _BattleManager_startAction = BattleManager.startAction;
    BattleManager.startAction = function() {
        if (this._subject instanceof Game_Actor) {
            if (this._actorCommandSelected) {
                if (ATBConfig.waitAnimation) this._atbManager.toWait("turn");
                _BattleManager_startAction.call(this);
            }
        } else {
            if (ATBConfig.useCTB || ATBConfig.waitSelectSkillOrItem) {
                this._atbManager.toWait("turn");
            }
            _BattleManager_startAction.call(this);
        }
    };

    const _BattleManager_endAction = BattleManager.endAction;
    BattleManager.endAction = function() {
        _BattleManager_endAction.call(this);
        this._atbManager.endAction(this._subject);
    };

    const _BattleManager_endTurn = BattleManager.endTurn;
    BattleManager.endTurn = function() {
        _BattleManager_endTurn.call(this);
        this._turnStarted = false;
    };

    BattleManager.selectNextCommand = function() {
        if (ATBConfig.useCTB) {
            this.startTurn();
            this._actorCommandSelecting = false;
        } else {
            BattleManager.setActorCommandSelected(true);
            this._actorCommandSelecting = false;
            this.startTurnATB();
        }
    };

    BattleManager.getNextSubject = function() {
        if (!ATBConfig.useCTB && this._subject && this._subject.gauge().isActionEnd()) {
            return null;
        }
        return this._atbManager.getNextSubject();
    };

    BattleManager.processEscape = function() {
        $gameParty.performEscape();
        SoundManager.playEscape();
        const success = this._preemptive ? true : (Math.random() < this._escapeRatio);
        if (success) {
            this.displayEscapeSuccessMessage();
            this._escaped = true;
            this.processAbort();
        } else {
            this.displayEscapeFailureMessage();
            this._escapeRatio += 0.1;
            this.endPause();
            if (ATBConfig.useCTB) {
                this.startTurn();
                this._atbManager.escapeFailed();
                this._actorCommandSelecting = false;
            } else {
                this.startTurnATB();
                this._atbManager.escapeFailed();
                this._actorCommandSelecting = false;
                this._actorCommandSelected = false;
                if (this._subject instanceof Game_Actor) {
                    this._subject = null;
                }
            }
        }
        return success;
    };

    const _BattleManager_isInputting = BattleManager.isInputting;
    BattleManager.isInputting = function() {
        if (ATBConfig.useCTB) {
            return _BattleManager_isInputting.call(this);
        } else {
            return _BattleManager_isInputting.call(this) && !this._turnStartReserve;
        }
    }

    const _BattleManager_update = BattleManager.update;
    BattleManager.update = function() {
        if (ATBConfig.useCTB) {
            _BattleManager_update.call(this);
        } else {
            if (!this.isBusy() && !this.updateEvent()) {
                switch (this._phase) {
                case "start":
                    this.startInput();
                    break;
                // ATBの場合は、input phaseの間でもターン更新を行う
                case "input":
                case "turn":
                    this.startTurnAwait();
                    this.updateTurn();
                    break;
                case "action":
                    this.updateAction();
                    break;
                case "turnEnd":
                    this.updateTurnEnd();
                    break;
                case "battleEnd":
                    this.updateBattleEnd();
                    break;
                }
            }
        }
    };

    // ATBモード時は、アクターコマンドの選択が完了してからターンを開始するようにする
    BattleManager.startTurnATB = function() {
        if (this._subject && !this._subject.gauge().isActionEnd()) {
            this._turnStartReserve = true;
            SceneManager._scene.changeInputWindow();
        } else {
            this.startTurn();
            this._turnStarted = true;
        }
    };

    BattleManager.startTurnAwait = function() {
        if (this._phase === "battleEnd") return;
        if (this._subject && this._subject.gauge().isActionEnd) {
            if (this._turnStartReserve) {
                this._turnStartReserve = false;
                this.startTurn();
            }
        }
    };

    BattleManager.updateGauge = function() {
        this._atbManager.updateGauge();
    }

    BattleManager.startPause = function() {
        this._atbManager.toWait("pause");
    }

    BattleManager.endPause = function() {
        this._atbManager.toActive("pause");
    }

    BattleManager.toActiveSelectSkillOrItem = function() {
        this._atbManager.toActive("selectSkillOrItem");
    }

    BattleManager.toWaitSelectSkillOrItem = function() {
        this._atbManager.toWait("selectSkillOrItem");
    }

    BattleManager.addStateApply = function(battler, stateId) {
        this._atbManager.addStateApply(battler, stateId);
    };

    BattleManager.eraseStateApply = function(battler, stateId) {
        this._atbManager.eraseStateApply(battler, stateId);
    };

    /* class Scene_Battle */
    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function() {
        _Scene_Battle_update.call(this);
        this.updateActorCommandWindow();
    };

    Scene_Battle.prototype.updateBattleProcess = function() {
        // CTBの場合は、BattleManager.updateTurn内でゲージを更新する
        if (!ATBConfig.useCTB) {
            if (BattleManager._phase === "input" || BattleManager._phase === "turn") {
                BattleManager.updateGauge();
            }
        }
        if (!this.isAnyInputWindowActive() || BattleManager.isAborting() ||
                BattleManager.isBattleEnd()) {
            BattleManager.update();
            if (!BattleManager.isActorCommandSelected()) {
                this.changeInputWindow();
            }
        }
    };

    Scene_Battle.prototype.updateActorCommandWindow = function() {
        if (!BattleManager.isActorCommandSelecting()) {
            this._actorCommandWindow.close();
            this._skillWindow.hide();
            this._itemWindow.hide();
            this._actorWindow.hide();
            this._enemyWindow.hide();
        }
    };


    // ターンを再開する
    Scene_Battle.prototype.commandFight = function() {
        BattleManager.endPause();
        BattleManager.setActorCommandSelecting(false);
        this.changeInputWindow();
    };

    // キャンセルでパーティウィンドウに戻す
    Scene_Battle.prototype.selectPreviousCommand = function() {
        this.startPartyCommandSelection();
    };

    // パーティコマンド選択時はポーズする
    const _Scene_Battle_startPartyCommandSelection = Scene_Battle.prototype.startPartyCommandSelection;
    Scene_Battle.prototype.startPartyCommandSelection = function() {
        BattleManager.startPause();
        if (ATBConfig.enableYEP_BattleEngineCore) {
            Yanfly.BEC.Scene_Battle_startPartyCommandSelection.call(this);
        } else {
            _Scene_Battle_startPartyCommandSelection.call(this);
        }
    };

    const _Scene_Battle_startActorCommandSelection = Scene_Battle.prototype.startActorCommandSelection;
    Scene_Battle.prototype.startActorCommandSelection = function() {
        if (ATBConfig.useCTB) {
            _Scene_Battle_startActorCommandSelection.call(this);
            BattleManager.setActorCommandSelected(true);
            BattleManager.setActorCommandSelecting(true);
        } else {
            if (!BattleManager.isActorCommandSelecting()) {
                _Scene_Battle_startActorCommandSelection.call(this);
                BattleManager.setActorCommandSelecting(true);
            }
        }
    };

    Scene_Battle.prototype.changeInputWindow = function() {
        if (ATBConfig.useCTB) {
            if (BattleManager.isInputting()) {
                if (BattleManager.actor()) {
                    this.startActorCommandSelection();
                } else {
                    this.selectNextCommand();
                }
            } else {
                this.endCommandSelection();
            }

        } else {
            if (BattleManager.isInputting()) {
                if (BattleManager.actor()) {
                    this.startActorCommandSelection();
                } else {
                    BattleManager.startTurn();
                }
            } else {
                // アクターウィンドウの選択が終了すると、アクターウィンドウを閉じる
                if (!BattleManager.isActorCommandSelecting()) {
                    this.endCommandSelection();
                }
            }
        }
    };

    // ATB時は、ステータスウィンドウを移動しないようにする
    const _Scene_Battle_updateWindowPositions = Scene_Battle.prototype.updateWindowPositions;
    Scene_Battle.prototype.updateWindowPositions = function() {
        if (ATBConfig.useCTB) {
            _Scene_Battle_updateWindowPositions.call(this);
        } else {
            statusX = this._partyCommandWindow.width;
            if (this._statusWindow.x < statusX) {
                this._statusWindow.x += 16;
                if (this._statusWindow.x > statusX) {
                    this._statusWindow.x = statusX;
                }
            }
            if (this._statusWindow.x > statusX) {
                this._statusWindow.x -= 16;
                if (this._statusWindow.x < statusX) {
                    this._statusWindow.x = statusX;
                }
            }
        }
    };

    // ATB時は、パーティコマンドが開いているとき以外は時間を進める
    const _Scene_Battle_isAnyInputWindowActive = Scene_Battle.prototype.isAnyInputWindowActive;
    Scene_Battle.prototype.isAnyInputWindowActive = function() {
        if (ATBConfig.useCTB) {
            return _Scene_Battle_isAnyInputWindowActive.call(this);
        }
        return this._partyCommandWindow.active;
    };

    const _Scene_Battle_commandSkill =  Scene_Battle.prototype.commandSkill;
    Scene_Battle.prototype.commandSkill = function() {
        if (!ATBConfig.useCTB && ATBConfig.waitSelectSkillOrItem) {
            BattleManager.toWaitSelectSkillOrItem();
        }
        _Scene_Battle_commandSkill.call(this);
    };

    const _Scene_Battle_commandItem = Scene_Battle.prototype.commandItem;
    Scene_Battle.prototype.commandItem = function() {
        if (!ATBConfig.useCTB && ATBConfig.waitSelectSkillOrItem) {
            BattleManager.toWaitSelectSkillOrItem();
        }
        _Scene_Battle_commandItem.call(this);
    };

    const _Scene_Battle_onSkillOk = Scene_Battle.prototype.onSkillOk;
    Scene_Battle.prototype.onSkillOk = function() {
        if (!ATBConfig.useCTB && ATBConfig.waitSelectSkillOrItem) {
            BattleManager.toActiveSelectSkillOrItem();
        }
        _Scene_Battle_onSkillOk.call(this);
    };

    const _Scene_Battle_onSkillCancel = Scene_Battle.prototype.onSkillCancel;
    Scene_Battle.prototype.onSkillCancel = function() {
        if (!ATBConfig.useCTB && ATBConfig.waitSelectSkillOrItem) {
            BattleManager.toActiveSelectSkillOrItem();
        }
        _Scene_Battle_onSkillCancel.call(this);
    };

    const _Scene_Battle_onItemOk = Scene_Battle.prototype.onItemOk;
    Scene_Battle.prototype.onItemOk = function() {
        if (!ATBConfig.useCTB && ATBConfig.waitSelectSkillOrItem) {
            BattleManager.toActiveSelectSkillOrItem();
        }
        _Scene_Battle_onItemOk.call(this);
    };

    const _Scene_Battle_onItemCancel = Scene_Battle.prototype.onItemCancel;
    Scene_Battle.prototype.onItemCancel = function() {
        if (!ATBConfig.useCTB && ATBConfig.waitSelectSkillOrItem) {
            BattleManager.toActiveSelectSkillOrItem();
        }
        _Scene_Battle_onItemCancel.call(this);
    };


    /* class Window_BattleStatus */
    const _Window_BattleStatus_drawGaugeAreaWithTp = Window_BattleStatus.prototype.drawGaugeAreaWithTp;
    Window_BattleStatus.prototype.drawGaugeAreaWithTp = function(rect, actor) {
        if (ATBConfig.drawUnderGauge) {
            _Window_BattleStatus_drawGaugeAreaWithTp.call(this, rect, actor);
        } else {
            this.drawActorHp(actor, rect.x + 0, rect.y, 108 * 0.8);
            this.drawActorMp(actor, rect.x + 123 * 0.8, rect.y, 96 * 0.8);
            this.drawActorTp(actor, rect.x + 234 * 0.8, rect.y, 96 * 0.8);
            this.drawActorCt(actor, rect.x + 334 * 0.8, rect.y, 96 * 0.8);
        }
    };

    const _Window_BattleStatus_drawGaugeAreaWithoutTp = Window_BattleStatus.prototype.drawGaugeAreaWithoutTp;
    Window_BattleStatus.prototype.drawGaugeAreaWithoutTp = function(rect, actor) {
        if (ATBConfig.drawUnderGauge) {
            _Window_BattleStatus_drawGaugeAreaWithoutTp.call(this, rect, actor);
        } else {
            _Window_BattleStatus_drawGaugeAreaWithoutTp.call(this, rect, actor);
            this.drawActorCt(actor, rect.x + 234, rect.y, 96);
        }
    };

    Window_BattleStatus.prototype.drawActorCt = function(actor, x, y, width) {
        width = width || 96;
        const gauge = actor.gauge();
        let color1, color2;
        if (actor.gauge() && actor.gauge().purpose === ATBGauge.PURPOSE_TIME) {
            color1 = this.textColor(30);
            color2 = this.textColor(31);
        } else {
            color1 = this.textColor(2);
            color2 = this.textColor(2);
        }
        const ctValue = Math.floor(actor.gauge() ? actor.gauge().value : 0);
        const ctRate = ctValue / ATBManager.GAUGE_MAX;
        this.drawGauge(x, y, width, ctRate, color1, color2);
        this.changeTextColor(this.systemColor());
        this.drawText("CT", x, y, 44);
        this.changeTextColor(this.normalColor());
    };


    class Sprite_GaugeLine extends Sprite {
        get GAUGE_WIDTH() { return 50 };
        get GAUGE_HEIGHT() { return 5 };

        initialize(battler) {
            const bitmap = new Bitmap(this.GAUGE_WIDTH, this.GAUGE_HEIGHT);
            super.initialize(bitmap);
            this._battler = battler;
            this._battlerSprite = battler.getSprite();
        }

        update() {
            super.update();
            if (BattleManager._phase !== "start") {
                if (this._battler instanceof Game_Actor) {
                    this.x = this._battlerSprite.x - 24;
                    this.y = this._battlerSprite.y;
                } else {
                    this.x = this._battlerSprite.x - this._battlerSprite.width / 4;
                    this.y = this._battlerSprite.y;
                }
                this.drawGauge(this._battler.gauge());
            }
        }

        drawGauge(gauge) {
            let width = 0;
            if (gauge.battler() instanceof Game_Enemy && gauge.battler().isDead()) {
                this.bitmap.clear();
                return;
            }
            if (gauge) {
                const ctRate = gauge.value / ATBManager.GAUGE_MAX;
                width = this.bitmap.width * ctRate;
            }
            this.bitmap.fillRect(0, 0, this.bitmap.width, this.bitmap.height, "#000000");
            if (gauge.purpose === ATBGauge.PURPOSE_SKILL_WAIT) {
                this.bitmap.fillRect(0, 0, width, this.bitmap.height, BattleManager._statusWindow.textColor(2));
            } else {
                this.bitmap.fillRect(0, 0, width, this.bitmap.height, BattleManager._statusWindow.textColor(31));
            }
        }
    }


    /* class Spriteset_Battle */
    Spriteset_Battle.prototype.createGaugeLines = function() {
        for (let battler of BattleManager.allBattleMembers()) {
            if (battler instanceof Game_Enemy) {
                if (ATBConfig.drawEnemyUnderGauge) this._baseSprite.addChild(new Sprite_GaugeLine(battler));
            } else {
                if (ATBConfig.drawUnderGauge) this._baseSprite.addChild(new Sprite_GaugeLine(battler));
            }
        }
    };

};
