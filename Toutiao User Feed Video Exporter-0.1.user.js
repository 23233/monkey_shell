// ==UserScript==
// @name         Toutiao User Feed Video Exporter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Export user feed data from Toutiao
// @match        https://www.toutiao.com/c/user/token/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    let feedData = [];
    let userId = '';

    let exportBtn = document.createElement('button');

    function interceptFeedRequests() {
        let originalXHR = unsafeWindow.XMLHttpRequest;
        unsafeWindow.XMLHttpRequest = function() {
            let xhr = new originalXHR();
            let originalOpen = xhr.open;

            xhr.open = function(method, url) {
                if (url.includes('/api/pc/list/user/feed')) {
                    xhr.addEventListener('load', function() {
                        if (xhr.status === 200) {
                            let response = JSON.parse(xhr.responseText);
                            console.log("response",response)
                            processFeedData(response?.data || []);
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
            let processedItem = {
                id: item.id,
                user_id: item.user.info.user_id,
                download_url: item.video?.download_addr?.url_list[0] || ''
            };
            feedData.push(processedItem);
        });

        if (!userId && feedData.length > 0) {
            userId = feedData[0].user_id;
        }

        updateExportButtonText();
    }

    function updateExportButtonText() {
        if (exportBtn) {
            exportBtn.textContent = `导出数据 (${feedData.length})`;
        }
    }

    function exportData() {

        if (feedData.length === 0) {
            alert('没有数据可供导出');
            return;
        }

        let fileName = `${userId}_${feedData.length}_${Date.now()}.json`;
        let jsonContent = JSON.stringify(feedData, null, 2);

        let blob = new Blob([jsonContent], {type: 'application/json'});
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.download = fileName;
        a.href = url;
        a.click();

    }

    function createExportButton() {
        exportBtn.textContent = '导出数据';
        exportBtn.style.position = 'fixed';
        exportBtn.style.right = '10px';
        exportBtn.style.bottom = '10px';
        exportBtn.style.zIndex = '9999';
        exportBtn.addEventListener('click', exportData);
        document.body.appendChild(exportBtn);
    }


    window.addEventListener('load', function () {
        createExportButton();
    });


    interceptFeedRequests();
})();