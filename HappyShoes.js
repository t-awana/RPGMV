// Generated by CoffeeScript 1.12.7

/*:
  @plugindesc 幸せの靴 ver1.0
  @author うなぎおおとろ(http://twitter.com/unagiootoro8388)
  @param CanMapLevelUp
  @desc マップ上でレベルアップするか否か
  @param NotGetExp_SwitchId
  @desc 経験値の取得を禁止するのに使用するスイッチのID
  @param NotGetExp_NoEncountMap
  @desc
  エンカウントなしのマップでは経験値を
  取得できないようにするか否か
  @help
  歩くたびに経験値の入る「幸せの靴」を再現するスクリプトです。

  [使用方法]
  幸せの靴にしたい装備品のメモ欄に、
  <幸せの靴>
  と記述してください。
  また、経験値がもらえるまでに必要な歩数と、一度にもらえる経験値も設定することができます。
  例えば、１０歩ごとに２０００の経験値が入手できるようにする場合は、
  <幸せの靴 steps=10 exp=2000>
  と記述してください。

  [プラグインコマンド]
  CanMapLevelUp
  マップ上でレベルアップするか否か
  trueを指定しないとレベルアップ可能な経験値に達しても戦闘しない限りレベルアップしません。

  NotGetExp_SwitchId
  経験値の取得を禁止するのに使用するスイッチのID
  経験値の取得禁止をスイッチで行わない場合は何も指定しないでください。

  NotGetExp_NoEncountMap
  エンカウントなしのマップでは経験値を取得できないようにするか否か
  trueを指定するとランダムエンカウント可能なマップでのみ経験値を獲得できるようになります。
 */

(function() {
  var HappyShoes;

  HappyShoes = (function() {
    var params;

    params = PluginManager.parameters('HappyShoes');

    HappyShoes.CanMapLevelUp = params["CanMapLevelUp"];

    HappyShoes.NotGetExp_SwitchId = params["NotGetExp_SwitchId"];

    HappyShoes.NotGetExp_NoEncountMap = params["NotGetExp_NoEncountMap"];

    function HappyShoes(steps1, exp1) {
      this.steps = steps1;
      this.exp = exp1;
      this.nextSteps = this.steps;
    }

    HappyShoes.prototype.increaseSteps = function() {
      this.nextSteps -= 1;
      if (this.nextSteps === 0) {
        return this.nextSteps = this.steps;
      }
    };

    return HappyShoes;

  })();

  Game_Map.prototype.canGetExp = function() {
    var id;
    if (HappyShoes.NotGetExp_NoEncountMap === "true" && this.encounterList().length === 0) {
      return false;
    } else if (HappyShoes.NotGetExp_SwitchId !== "") {
      id = parseInt(HappyShoes.NotGetExp_SwitchId, 10);
      if ($gameSwitches.value(id)) {
        return false;
      }
    }
    return true;
  };

  Game_Item.prototype.happyShoes = function() {
    var exp, i, len, param, params, steps;
    if (this.object()) {
      if (this._happyShoes === void 0) {
        if (this.object().note.match(/^<幸せの靴(.*)>/)) {
          steps = 1;
          exp = 1;
          params = RegExp.$1.split(" ");
          for (i = 0, len = params.length; i < len; i++) {
            param = params[i];
            if (param.match(/(.+)=(.+)/)) {
              eval(RegExp.$1 + " = " + RegExp.$2 + ";");
            }
          }
          this._happyShoes = new HappyShoes(steps, exp);
        } else {
          this._happyShoes = false;
        }
      }
      return this._happyShoes;
    }
    return null;
  };

  Game_Actor.prototype.setExp = function(exp) {
    return this._exp[this._classId] = exp;
  };

  Game_Party.prototype.happyShoes__increaseSteps = Game_Party.prototype.increaseSteps;

  Game_Party.prototype.increaseSteps = function() {
    var actor, equip, exp, happyShoes, i, j, len, len1, ref, ref1, results;
    this.happyShoes__increaseSteps();
    if (!$gameMap.canGetExp()) {
      return;
    }
    ref = this.allMembers();
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      actor = ref[i];
      exp = 0;
      ref1 = actor._equips;
      for (j = 0, len1 = ref1.length; j < len1; j++) {
        equip = ref1[j];
        if (!equip) {
          continue;
        }
        if (happyShoes = equip.happyShoes()) {
          if (happyShoes.nextSteps === 1) {
            exp += happyShoes.exp;
          }
          happyShoes.increaseSteps();
        }
      }
      if (exp > 0) {
        if (HappyShoes.CanMapLevelUp === "true") {
          results.push(actor.changeExp(actor.currentExp() + exp, true));
        } else {
          results.push(actor.setExp(actor.currentExp() + exp));
        }
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

}).call(this);
