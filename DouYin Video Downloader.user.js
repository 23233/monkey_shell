// ==UserScript==
// @name         抖音视频下载助手
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  在抖音视频页面添加下载按钮
// @author       23233
// @match        https://www.douyin.com/video/*
// @grant        GM_download
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 创建下载按钮
    function createDownloadButton() {
        const button = document.createElement('button');
        button.innerHTML = '下载视频';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #fe2c55;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        button.addEventListener('click', downloadVideo);
        document.body.appendChild(button);
    }

    // 下载视频函数
    function downloadVideo() {
        // 获取带有data-xgplayerid属性的video标签
        const videoElement = document.querySelector('video[data-xgplayerid]');
        
        if (!videoElement) {
            alert('未找到视频元素');
            return;
        }

        // 获取所有source标签中的最后一个链接
        const sources = videoElement.getElementsByTagName('source');
        const lastSource = sources[sources.length - 1];
        
        if (!lastSource || !lastSource.src) {
            alert('未找到视频源');
            return;
        }

        // 从URL中提取视频ID作为文件名
        const videoId = window.location.pathname.split('/').pop().split('?')[0];
        const fileName = `${videoId}.mp4`;

        // 使用GM_download下载视频
        GM_download({
            url: lastSource.src,
            name: fileName,
            onerror: (error) => {
                alert('下载失败: ' + error);
            }
        });
    }
    // 等待页面加载完成后添加下载按钮
    window.addEventListener('load', () => {
        console.log("页面加载完成")
        setTimeout(createDownloadButton, 2000); // 延迟2秒添加按钮，确保视频元素已加载
    });
})(); 