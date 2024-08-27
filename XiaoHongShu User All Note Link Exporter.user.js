// ==UserScript==
// @name         小红书用户主页笔记导出
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Export user all note link from XiaoHongShu
// @match        https://www.xiaohongshu.com/user/profile/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    let feedData = [];
    let userId = '';

    let exportBtn = document.createElement('button');
    let exportBtn2 = document.createElement('button');

    let allProfileLinks = new Set();

    function interceptFeedRequests() {
        let originalXHR = unsafeWindow.XMLHttpRequest;
        unsafeWindow.XMLHttpRequest = function () {
            let xhr = new originalXHR();
            let originalOpen = xhr.open;

            xhr.open = function (method, url) {
                if (url.includes('/api/sns/web/v1/user_posted')) {
                    xhr.addEventListener('load', function () {
                        if (xhr.status === 200) {
                            let response = JSON.parse(xhr.responseText);
                            console.log("response", response)
                            processFeedData(response?.data?.notes || []);
                        }
                    });
                }
                originalOpen.apply(xhr, arguments);
            };

            return xhr;
        };
    }

    function processFeedData(data) {
        data.forEach(item => {
            if (item.type == "video") {
                let processedItem = {
                    id: item.note_id,
                    user_id: item.user.user_id,
                    xsec_token: item.xsec_token,
                    type: item.type,
                    title: item.display_title,
                    visit_url: `https://www.xiaohongshu.com/explore/${item.note_id}?xsec_token=${item.xsec_token}`
                };
                feedData.push(processedItem);
            }
        });

        if (!userId && feedData.length > 0) {
            userId = feedData[0].user_id;
        }

        updateExportButtonText();
    }

    function updateExportButtonText() {
        if (exportBtn) {
            exportBtn.textContent = `导出笔记 (${feedData.length})`;
        }
    }


    function exportData() {

        if (feedData.length === 0) {
            alert('没有数据可供导出');
            return;
        }

        let fileName = `${userId}_${feedData.length}_${Date.now()}.json`;
        let jsonContent = JSON.stringify(feedData, null, 2);

        let blob = new Blob([jsonContent], { type: 'application/json' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.download = fileName;
        a.href = url;
        a.click();

    }

    function exportData2() {
        if (allProfileLinks.size === 0) {
            alert('没有找到任何笔记链接');
            return;
        }

        const exportData = Array.from(allProfileLinks).join('\n');
        const blob = new Blob([exportData], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const now_url = new URL(window.location.href).pathname.split("/")
        const uid = now_url[now_url.length - 1];

        const a = document.createElement('a');
        a.href = url;
        a.download = `user_profile_links_${uid}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
    }

    function captureVisibleLinks() {
        const links = document.querySelectorAll('#userPostedFeeds a.cover[href^="/user/profile"]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            const url = new URL(href, 'https://www.xiaohongshu.com');
            const pathSegments = url.pathname.split('/');
            const lastPath = pathSegments[pathSegments.length - 1];
            const hrefParam = url.searchParams.toString();
            allProfileLinks.add(`https://www.xiaohongshu.com/explore/${lastPath}?${hrefParam}`);
        });
        updateExportButton2Text();
    }

    function updateExportButton2Text() {
        if (exportBtn2) {
            exportBtn2.textContent = `链接导出笔记 (${allProfileLinks.size})`;
        }
    }

    function createExportButton() {
        exportBtn.textContent = '导出笔记';
        exportBtn.style.position = 'fixed';
        exportBtn.style.right = '10px';
        exportBtn.style.bottom = '10px';
        exportBtn.style.zIndex = '9999';
        exportBtn.addEventListener('click', exportData);
        document.body.appendChild(exportBtn);

        exportBtn2.textContent = '链接导出笔记 (0)';
        exportBtn2.style.position = 'fixed';
        exportBtn2.style.right = '10px';
        exportBtn2.style.bottom = '30px';
        exportBtn2.style.zIndex = '9999';
        exportBtn2.addEventListener('click', exportData2);
        document.body.appendChild(exportBtn2);

    }

    window.addEventListener('load', function () {
        createExportButton();
        captureVisibleLinks(); // 初始捕获
        // 添加滚动事件监听器
        window.addEventListener('scroll', captureVisibleLinks);
    });

    interceptFeedRequests();
})();