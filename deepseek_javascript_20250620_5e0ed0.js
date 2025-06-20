// ==UserScript==
// @name         视频解析助手（带自动播放）
// @namespace    http://tampermonkey.net/
// @version      17.0
// @description 点击解析自动跳转并播放
// @author       YourName
// @match        *://*.iqiyi.com/*
// @match        *://*.youku.com/*
// @match        *://*.qq.com/*
// @match        *://*.mgtv.com/*
// @grant        GM_openInTab
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 强化样式确保按钮可见
    GM_addStyle(`
        .parse-btn-auto {
            position: absolute !important;
            z-index: 2147483647 !important;
            padding: 8px 16px !important;
            background: linear-gradient(135deg, #4facfe, #00f2fe) !important;
            color: white !important;
            border: none !important;
            border-radius: 20px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: bold !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            font-family: "Microsoft YaHei", sans-serif !important;
            min-width: 80px !important;
            text-align: center !important;
            opacity: 0.9 !important;
            transition: all 0.3s !important;
        }
        .parse-btn-auto:hover {
            opacity: 1 !important;
            transform: scale(1.05) !important;
            box-shadow: 0 6px 15px rgba(0,0,0,0.4) !important;
        }
        /* 平台定位 */
        .iqiyi-parse { right: 20px; top: 50%; transform: translateY(-50%); }
        .youku-parse { right: 20px; top: 50%; transform: translateY(-50%); }
        .qq-parse { right: 20px; bottom: 60px; }
        .mgtv-parse { left: 50%; bottom: 20px; transform: translateX(-50%); }
        /* 播放器容器定位 */
        .parse-player-container {
            position: relative !important;
        }
    `);

    // 生成带自动播放参数的URL
    function generateAutoPlayUrl() {
        const currentUrl = encodeURIComponent(window.location.href);
        // 确保URL中只包含一个autoplay参数
        let baseUrl = 'https://jx.mmxia.site/?url=';
        if (currentUrl.includes('autoplay=')) {
            return currentUrl.replace(/autoplay=[^&]*/, 'autoplay=true');
        }
        return `${baseUrl}${currentUrl}&autoplay=true`;
    }

    // 创建解析按钮
    function createParseButton(platform) {
        const btn = document.createElement('button');
        btn.className = `parse-btn-auto ${platform}-parse`;
        btn.textContent = '解析播放';
        btn.title = '点击自动跳转并播放';
        
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            
            // 停止当前视频
            stopCurrentVideo(platform);
            
            // 打开带自动播放的解析页面
            const parseUrl = generateAutoPlayUrl();
            GM_openInTab(parseUrl, { 
                active: true,
                insert: true,
                setParent: true
            });
        });
        
        return btn;
    }

    // 停止当前视频播放
    function stopCurrentVideo(platform) {
        try {
            // 平台特定停止方法
            switch(platform) {
                case 'iqiyi':
                    if (window.PlayerContext?.getInstance()?.pause) {
                        window.PlayerContext.getInstance().pause();
                    }
                    break;
                case 'youku':
                    if (window.YoukuPlayer?.pause) window.YoukuPlayer.pause();
                    break;
                case 'qq':
                    if (window.TXVideoPlayer?.getCurrentPlayer()) {
                        window.TXVideoPlayer.getCurrentPlayer().stop();
                    }
                    break;
                case 'mgtv':
                    const player = document.querySelector('.mgtv-player-container')?.__vue__;
                    if (player?.pause) player.pause();
                    break;
            }
            
            // 强制停止所有video元素
            document.querySelectorAll('video').forEach(v => {
                v.pause();
                v.currentTime = 0;
                v.volume = 0;
            });
        } catch (e) {
            console.error('停止播放失败:', e);
        }
    }

    // 查找播放器容器
    function findPlayerContainer(platform) {
        const selectors = {
            iqiyi: ['.qy-player-container', '.player-area', '.player-container'],
            youku: ['#player', '.yk-player', '.player-container'],
            qq: ['#player-container', '.txp_player', '.player-container'],
            mgtv: ['.mgtv-player-container', '.player-wrapper']
        };
        
        for (const selector of selectors[platform]) {
            const container = document.querySelector(selector);
            if (container) return container;
        }
        return document.querySelector('video')?.parentElement;
    }

    // 注入解析按钮
    function injectParseButton() {
        const platform = getCurrentPlatform();
        if (!platform) return;
        
        const container = findPlayerContainer(platform);
        if (!container) {
            setTimeout(injectParseButton, 2000); // 2秒后重试
            return;
        }
        
        // 确保容器有定位
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
            container.classList.add('parse-player-container');
        }
        
        // 防止重复注入
        if (container.querySelector('.parse-btn-auto')) return;
        
        const btn = createParseButton(platform);
        container.appendChild(btn);
    }

    // 获取当前平台
    function getCurrentPlatform() {
        const host = location.host;
        if (host.includes('iqiyi.com')) return 'iqiyi';
        if (host.includes('youku.com')) return 'youku';
        if (host.includes('qq.com')) return 'qq';
        if (host.includes('mgtv.com')) return 'mgtv';
        return null;
    }

    // 初始化
    function init() {
        // 立即尝试注入
        injectParseButton();
        
        // 监听DOM变化
        new MutationObserver(injectParseButton).observe(document, {
            childList: true,
            subtree: true
        });
        
        // 平台特定事件
        if (location.host.includes('qq.com')) {
            document.addEventListener('txplayer_load', injectParseButton);
        }
        if (location.host.includes('iqiyi.com')) {
            document.addEventListener('qyPlayerInit', injectParseButton);
        }
        
        // 定时检查（每5秒）
        setInterval(injectParseButton, 5000);
    }

    // 启动脚本
    if (document.readyState === 'complete') {
        setTimeout(init, 1000); // 延迟1秒确保播放器初始化
    } else {
        window.addEventListener('load', init);
    }
})();