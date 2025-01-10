// ==UserScript==
// @name         YouTube Shorts Link Extractor
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  提取所有 Shorts 链接并导出为 TXT 文件
// @author       23233
// @match        https://www.youtube.com/*/shorts
// @grant        GM_download
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 设置样式
    GM_addStyle(`
        #exportButton {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background-color: #FF0000;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            z-index: 1000;
        }
        #exportButton:hover {
            background-color: #FF4444;
        }
    `);

    // 存储所有链接
    let links = [];
    let isScrolling = false;

    // 添加导出按钮
    const exportButton = document.createElement('button');
    exportButton.id = 'exportButton';
    exportButton.textContent = '导出 0 条链接';
    exportButton.addEventListener('click', () => {
        const textContent = links.join('\n');
        const blob = new Blob([textContent], { type: 'text/plain' });

        // 获取当前URL并提取倒数第二部分作为文件名
        const urlParts = window.location.pathname.split('/');
        const channelName = urlParts[urlParts.length - 2]; // 倒数第二个路径部分

        GM_download({
            url: URL.createObjectURL(blob),
            name: `${channelName}_shorts_links.txt`,
            saveAs: true
        });
    });
    document.body.appendChild(exportButton);

    // 获取所有符合条件的链接
    function extractLinks() {
        const aTags = document.querySelectorAll('a.shortsLockupViewModelHostEndpoint');
        aTags.forEach((a) => {
            const href = a.getAttribute('href');
            if (href && href.startsWith('/shorts')) {
                const fullLink = 'https://www.youtube.com' + href;
                if (!links.includes(fullLink)) {
                    links.push(fullLink);
                }
            }
        });
        exportButton.textContent = `导出 ${links.length} 条链接`;
    }

    // 监听滚动事件
    window.addEventListener('scroll', () => {
        if (!isScrolling) {
            isScrolling = true;
            setTimeout(() => {
                extractLinks();
                isScrolling = false;
            }, 200);
        }
    });

    // 页面加载完成后再次提取链接
    window.onload = function() {
        extractLinks();
    };

    // 初始提取链接
    extractLinks();

})();
