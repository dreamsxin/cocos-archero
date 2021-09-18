import { AudioManager } from './framework/audioManager';
import { GameManager } from './fight/gameManager';
import { constant } from './framework/constant';
import { clientEvent } from './framework/clientEvent';
import { _decorator, Component, game, Game, PhysicsSystem, Node, profiler, TERRAIN_HEIGHT_BASE } from 'cc';
import { playerData } from './framework/playerData';
import { StorageManager } from './framework/storageManager';
import { localConfig } from './framework/localConfig';
import { util } from './framework/util';
import { SdkUtil } from './framework/sdkUtil';
import { uiManager } from './framework/uiManager';

const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {
    @property(Node)
    public ndGameStart: Node = null!;

    private _minLoadDuration: number = 3.5;//加载开屏最小持续时间
    private _curLoadDuration: number = 0;//当前加载开屏界面时间
    private _isHideNdGameStart: boolean = false;//是否把gameStart这个节点隐藏
    private _scriptFightPanel: any = null!;
    private _scriptHomePanel: any = null!;

    onEnable () {
        clientEvent.on(constant.EVENT_TYPE.REMOVE_NODE_GAME_START, this._removeNdGameStart, this);
    }

    onDisable () {
        clientEvent.off(constant.EVENT_TYPE.REMOVE_NODE_GAME_START, this._removeNdGameStart, this);
    }

    start () {
        //游戏帧率设置并保存在本地
        let frameRate = StorageManager.instance.getGlobalData("frameRate");
        if (typeof frameRate !== "number") {
            frameRate = constant.GAME_FRAME;
            //@ts-ignore
            if (window.wx && util.checkIsLowPhone()) {
                frameRate = 30;
            } 

            StorageManager.instance.setGlobalData("frameRate", frameRate);
        } 

        console.log("###frameRate", frameRate);

        game.frameRate = frameRate;
        //设置步长，两个物理检测帧之间的时间间隔
        PhysicsSystem.instance.fixedTimeStep = 1 / frameRate;

        //是否开启debug，并保存在本地
        let isDebugOpen = StorageManager.instance.getGlobalData("debug") ?? false;
        isDebugOpen === true ? profiler.showStats() : profiler.hideStats();

        //游戏开始节点显示
        this.ndGameStart.active = true;
        //初始化当前加载时间       
        this._curLoadDuration = 0; 

        //@ts-ignore
        if (window.cocosAnalytics) {
            //@ts-ignore
            window.cocosAnalytics.init({
                appID: "605630324",              // 游戏ID
                version: '1.0.0',           // 游戏/应用版本号
                storeID: "cocosPlay",     // 分发渠道
                engine: "cocos",            // 游戏引擎
            });
        }
        //加载用户数据，判断玩家userid是否存在，不存在就生成随机id
        playerData.instance.loadGlobalCache();
        if (!playerData.instance.userId) {
            playerData.instance.generateRandomAccount();
            console.log("###生成随机userId", playerData.instance.userId);
        }
        //加载本地存储数据
        playerData.instance.loadFromCache();
        //玩家信息不存在或者玩家创建时间不存在，就去重新创建一个玩家
        if (!playerData.instance.playerInfo || !playerData.instance.playerInfo.createDate) {
            playerData.instance.createPlayerInfo();
        }

        //加载CSV相关配置到localConfig中，就可以通过localConfig来取配置
        localConfig.instance.loadConfig(()=>{
            this._loadFinish();
            SdkUtil.shareGame(constant.GAME_NAME_CH, "");
        })

        //声音管理者的初始化
        // AudioManager.instance.init();
        //音乐和音效的设置
        AudioManager.instance.setMusic(0.3);

        //引导
        //GuideManager.instance.start();

        //加载子包
        // SubPackageManager.instance.loadAllPackage();

        //切到后台时执行的监听回调，切到后台时保存玩家数据，保存本地数据
        game.on(Game.EVENT_HIDE, ()=>{
            if (!playerData.instance.settings) {
                playerData.instance.settings = {}
            }

            playerData.instance.settings.hideTime = Date.now();
            playerData.instance.saveAll();
            StorageManager.instance.save();
        })
    }

    //加载csv配置完成
    private _loadFinish () {
        GameManager.isFirstLoad = true;
        //展示home界面
        uiManager.instance.showDialog("home/homePanel", [()=>{
            if (this._scriptFightPanel) {
                this._scriptFightPanel.node.active = true;
            }
        }], (script: any)=>{                
            this._scriptHomePanel = script;

            uiManager.instance.showDialog("fight/fightPanel", [], (script: any)=>{
                this._scriptFightPanel = script;
                script.node.active = false;
                clientEvent.dispatchEvent(constant.EVENT_TYPE.ON_GAME_INIT);
            }, constant.PRIORITY.ZERO);
        }, constant.PRIORITY.ZERO);
    }

    private _removeNdGameStart () {
        this._isHideNdGameStart = true;
        this._scriptHomePanel.node.setSiblingIndex(this._scriptHomePanel.node.parent.children.length - 1);
    }

    update (deltaTime: number) {
        if (this.ndGameStart.parent) {
            this._curLoadDuration += deltaTime;
            if (this._curLoadDuration >= this._minLoadDuration && this._isHideNdGameStart) {
                this.ndGameStart.removeFromParent();   
            }
        }
    }
}
