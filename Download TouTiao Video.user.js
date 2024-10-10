// ==UserScript==
// @name         一键下载头条视频
// @namespace    http://tampermonkey.net/
// @version      2024-10-10
// @description  一键下载头条视频
// @author       23233
// @match        https://www.toutiao.com/video/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=toutiao.com
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// ==/UserScript==

(function () {
    'use strict';

    // 等待页面加载完成
    window.addEventListener('load', function () {

        // 获取页面中的 video 标签
        const videoElement = document.querySelector('video');

        if (videoElement && videoElement.src) {
            const videoSrc = videoElement.src;

            // 获取当前URL路径，最后一个如果为空则取倒数第二个
            const urlParts = window.location.pathname.split('/');
            let fileName = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
            fileName += '.mp4';  // 添加 .mp4 后缀

            // 创建下载按钮
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = '下载视频';
            downloadBtn.style.position = 'fixed';
            downloadBtn.style.right = '20px';
            downloadBtn.style.bottom = '20px';
            downloadBtn.style.zIndex = '1000';
            downloadBtn.style.padding = '10px 20px';
            downloadBtn.style.backgroundColor = '#f56c6c';
            downloadBtn.style.color = '#fff';
            downloadBtn.style.border = 'none';
            downloadBtn.style.borderRadius = '5px';
            downloadBtn.style.cursor = 'pointer';

            // 点击按钮时下载视频
            downloadBtn.addEventListener('click', function () {
                // 使用 GM_xmlhttpRequest 来绕过跨域限制进行下载
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: videoSrc,
                    responseType: 'blob',
                    onload: function (response) {
                        // 使用 GM_download 来下载文件
                        const blob = new Blob([response.response], { type: 'video/mp4' });
                        const url = window.URL.createObjectURL(blob);
                        GM_download({
                            url: url,
                            name: fileName
                        });
                    },
                    onerror: function (error) {
                        console.error('视频下载失败:', error);
                    }
                });
            });

            // 将按钮添加到页面上
            document.body.appendChild(downloadBtn);
        } else {
            console.log('未找到视频源。');
        }
    });
})();
