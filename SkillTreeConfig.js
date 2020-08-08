/*:
@plugindesc スキルツリーコンフィグ
@author うなぎおおとろ(twitter https://twitter.com/unagiootoro8388)

@help
[概要]
スキルツリーを導入するプラグインです。
SPを使ってスキルを習得するスキルツリーを作成することができます。

[使用方法]
■ スキルツリーの設定
スキルツリーの設定は、「SkillTreeConfig.js」ファイルを編集することで行います。
基本的な設定としては、アクターごとにスキルツリーのタイプ(剣スキルや魔法スキルなど)を設定し、
そしてタイプごとにスキルツリーを構築します。
スキルツリーの構築は、スキルの派生設定(ファイアⅠを取得したらファイアⅡが取得可能になるなど)によって行います。

■ SPの入手設定
スキルの習得には、SPが必要となります。
SPの入手方法としては
・戦闘終了による獲得
・レベルアップによるSP獲得
の二通りの設定を行うことができます。

・戦闘終了時に得られるSPの設定方法
敵キャラのメモ欄に
<battleEndGainSp: SP>
の形式で記載します。

・レベルアップによるSP獲得方法の設定
コンフィグの「levelUpGainSp」によって設定を行います。

■ イベントでSPを獲得する方法
スクリプトで
skt_gainSp(アクターID, 獲得するSP値)
と記載することで、該当のアクターが指定したSPを獲得することができます。
例えば、アクターIDが1のアクターが5SPを獲得する場合、
skt_gainSp(1, 5);
と記載します。

■ スキルリセット
スクリプトで
skt_skillReset(アクターID);
と記載することで、一度習得したスキルをリセットすることができます。
例えば、アクターIDが1のアクターのスキルリセットを行う場合、
skt_skillReset(1);
と記載します。

■ スキルツリータイプの有効/無効
スクリプトで
skt_enableType(アクターID, "タイプ名");
と記載することで、タイプを有効にします。

無効にする場合は、
skt_disableType(アクターID, "タイプ名")
と記載します。

無効にしたタイプは、スキルツリーのタイプ一覧には表示されません。

■ タイプの引継ぎ
特定の条件を満たすとスキルツリーに新たなスキルが追加されるようにしたい場合、「タイプの引継ぎ」を使用します。
例えば、タイプ「下位魔法」を「上位魔法」に変更したい場合、あらかじめ両方のタイプをコンフィグに登録した上で、
「上位魔法」は無効化しておきます。そして、タイプの引継ぎ機能を用いて、「下位魔法」を「上位魔法」に引き継がせます。

タイプの引継ぎを行う場合、スクリプトで
skt_migrationType(アクターID, "引継ぎ元タイプ名", "引継ぎ先タイプ名", リセット有無);
と記載します。リセット有無については、引継ぎ後、引継ぎ元のタイプのスキルツリーをリセットする場合、trueを、
リセットしない場合、falseを指定します。
例えば、アクターIDが1のアクターが、タイプ「下位魔法」を「上位魔法」に引き継がせ、さらにスキルリセットを行う場合、
skt_migrationType(アクターID, "下位魔法", "上位魔法", true);
と記載します。

■ マップからスキルツリーを読み込む
マップからスキルツリーの各スキルの配置座標を読み込むことで、ある程度自由なレイアウトのスキルツリーを
作成することができます。この機能によって設定可能なのはスキルの座標のみであり、スキル間の線はプラグイン側で描画します。

・スキル座標の設定
マップ上のイベントにて、設定を行います。
例えば、"ファイア"というスキルがある場合、スキルを配置したい座標に空のイベントを作成し、
イベントのメモ欄に
ファイア
と記載します。すると、"ファイア"とメモ欄に記載したイベントのXY座標がスキルのXY座標として使用されます。

・マップの読み込み
まずイベントコマンドで、スキルツリー読み込み対象のマップに「場所移動」します。
そして、スクリプト
skt_loadMap(スキルツリーの対象アクターID, スキルツリーの対象タイプ名)
を実行します。
例えば、アクターID1のアクターで、タイプ"攻撃魔法"のスキルツリーを読み込む場合、
skt_loadMap(1, "攻撃魔法");
と記載します。
*/

const SkillTreeConfig = {
    // =============================================================
    // ●ここからは設定項目です。
    // =============================================================

    // スキルツリーのタイプの設定を行います。
    // skillTreeTypes: [ ～ ]の中にアクターの数だけタイプ設定を追加します。

    // タイプ設定は、次の形式で設定します。
    // { actorId: アクターのID, types: [タイプ情報1, タイプ情報2, ...] }

    // タイプ情報は、次の形式で設定します。
    // [タイプ種別, タイプ名, タイプの説明]
    // タイプ種別...スキルの派生設定でタイプを識別するためのユニークな識別子を設定します。
    // タイプ名...タイプ一覧のウィンドウに表示するタイプ名を設定します。
    // タイプの説明...タイプ一覧のウィンドウに表示するタイプの説明を設定します。
    // タイプ有効/無効...タイプを有効にする場合は、trueを、無効にする場合は、falseを指定します。
    //                  この項目については、省略可能です。省略した場合、trueが指定されます。
    skillTreeTypes: [
        {
            actorId: 1,
            types: [
                ["攻撃スキル", "攻撃スキル1", "攻撃スキルを取得します。"],
                ["魔法スキル", "魔法スキル1", "魔法スキルを取得します。"],
                ["全スキル", "全スキル1", "攻撃スキルと魔法スキルの両方を取得します。"],
            ]
        },

        {
            actorId: 2,
            types: [
                ["攻撃スキル", "攻撃スキル2", "攻撃スキルを取得します。"],
                ["魔法スキル", "魔法スキル2", "魔法スキルを取得します。"],
                ["全スキル", "全スキル2", "攻撃スキルと魔法スキルの両方を取得します。"],
            ]
        },

        {
            actorId: 3,
            types: [
                ["攻撃スキル", "攻撃スキル3", "攻撃スキルを取得します。"],
                ["魔法スキル", "魔法スキル3", "魔法スキルを取得します。"],
                ["全スキル", "全スキル3", "攻撃スキルと魔法スキルの両方を取得します。"],
            ]
        },

        {
            actorId: 4,
            types: [
                ["攻撃スキル", "攻撃スキル4", "攻撃スキルを取得します。"],
                ["魔法スキル", "魔法スキル4", "魔法スキルを取得します。"],
                ["全スキル", "全スキル4", "攻撃スキルと魔法スキルの両方を取得します。"],
            ]
        },
    ],

    // 各スキルの情報を登録します。
    // skillTreeInfo: [ ～ ]の中に登録するスキル数分のスキル情報の登録を行います。

    // スキル情報の登録は次の形式で行います。
    // [スキル名, スキルID, 必要SP, アイコン情報]
    // スキル名...スキルツリーの派生設定でスキルを一意に識別するための識別子
    //            識別子なので、実際のスキル名と一致していなくても問題はありません。
    // スキルID...データベース上で該当するスキルのID
    // 必要SP...スキルの習得に必要なSP
    // アイコン情報については、アイコンを使用するか、任意の画像を使用するかに応じて次の形式で登録します。
    //   アイコンを使用する場合 ["icon", iconIndex]
    //   iconIndex...使用するアイコンのインデックス
    //               iconIndexは省略可能です。省略した場合、スキルに設定されているアイコンが使用されます。
    //   画像を使用する場合 ["img", fileName]
    //   fileName...画像のファイル名。画像は、「img/pictures」フォルダにインポートしてください。
    skillTreeInfo: [
        ["連続攻撃", 3, 1, ["icon"]],
        ["様子を見る", 7, 1, ["icon"]],
        ["２回攻撃", 4, 2, ["icon"]],
        ["３回攻撃", 5, 3, ["icon"]],
        ["ヒール", 8, 1, ["icon"]],
        ["ファイア", 9, 2, ["icon"]],
        ["スパーク", 10, 3, ["icon"]],
    ],

    // スキルツリーの派生設定を行います。
    // skillTreeDerivative: { ～ }の中にタイプ数分のスキルツリーの登録を行います。

    // スキルツリーの派生設定は次のように行います。
    // "タイプ名": [ [スキル1, [派生先スキル1, 派生先スキル2, ...]], [スキル2, [派生先スキル3, 派生先スキル4, ...] ]
    // ※派生先スキルが存在しない終端スキルの場合、派生先スキルは省略可能です。
    //
    // 例えば、"様子を見る"と"連続攻撃"を取得すると、"２回攻撃"が取得できるようにするには、次の設定を行います。
    // ["様子を見る", ["２回攻撃"]],
    // ["連続攻撃", ["２回攻撃"]],
    // ["２回攻撃"],
    //
    // また、"ヒール"を取得すると、"ファイア"と"スパーク"が取得できるようにするには、次の設定を行います。
    // ["ヒール", ["ファイア"]],
    // ["ヒール", ["スパーク"]],
    // ["ファイア"],
    // ["スパーク"],
    skillTreeDerivative: {
        "攻撃スキル": [
            ["様子を見る", ["２回攻撃"]],
            ["連続攻撃", ["２回攻撃"]],
            ["２回攻撃"],
        ],

        "魔法スキル": [
            ["ヒール", ["ファイア"]],
            ["ヒール", ["スパーク"]],
            ["ファイア"],
            ["スパーク"],
        ],

        "全スキル": [
            ["様子を見る", ["２回攻撃"]],
            ["連続攻撃", ["２回攻撃"]],
            ["２回攻撃"],

            ["ヒール", ["スパーク"]],
            ["ファイア", ["スパーク"]],
            ["スパーク"],

            ["２回攻撃", ["３回攻撃"]],
            ["スパーク", ["３回攻撃"]],
            ["３回攻撃"],
        ]
    },

    // レベルアップによってSPを獲得する場合、レベルごとに得られるSP値を設定します。
    // "default": デフォルト値, "レベル": SP値, "レベル": SP値
    // 下記の設定例では、レベル2では3SP取得、レベル3では4SP取得、それ以外のレベルでは5SPを獲得します。
    levelUpGainSp: [
        {
            classId: 1,
            default: 5,
            2: 3,
            3: 4,
        },

        {
            classId: 2,
            default: 5,
            2: 3,
            3: 4,
        },

        {
            classId: 3,
            default: 5,
            2: 3,
            3: 4,
        },

        {
            classId: 4,
            default: 5,
            2: 3,
            3: 4,
        },
    ]
    // =============================================================
    // ●設定項目はここまでです。
    // =============================================================
}
