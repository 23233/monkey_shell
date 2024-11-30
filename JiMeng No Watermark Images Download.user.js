// ==UserScript==
// @name         即梦图片无水印下载（聚合下载版）
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  按history_group_key聚合，再通过created_time按天聚合，再按分辨率进行聚合，并选择下载
// @author       23233
// @match        https://jimeng.jianying.com/ai-tool/image/generate
// @grant        GM_download
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    let groupedData = {}; // 用于存储按history_group_key和日期聚合的数据

    // 拦截并处理XHR
    const interceptXHR = () => {
        console.log("Initializing XHR interception...");
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this._url = url; // 保存URL
            return originalOpen.apply(this, [method, url, ...rest]);
        };

        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (...args) {
            this.addEventListener('load', function () {
                if (this._url.includes('https://jimeng.jianying.com/mweb/v1/get_history_by_ids') ||
                    this._url.includes('https://jimeng.jianying.com/mweb/v1/get_history')) {
                    processResponse(this.responseText, this._url.includes('get_history_by_ids') ? 'get_history_by_ids' : 'get_history');
                }
            });

            return originalSend.apply(this, args);
        };
    };

    // 处理响应数据
    const processResponse = (responseText, type) => {
        console.log("进入拦截请求",type)
        try {
            const response = JSON.parse(responseText);
            let records = [];
            let task;

            if (type === 'get_history_by_ids') {
                const firstKey = Object.keys(response.data)[0];
                records = response.data[firstKey]?.item_list || [];
                task = response.data[firstKey]?.task;
            } else if (type === 'get_history') {
                records = response.data?.records_list || [];

            }

            records.forEach(item => {
                const {common_attr,item_list } = item;
                if (!common_attr && !item_list )return;

                let { history_group_key, created_time } = item


                // 如果item_list存在，则遍历item_list
                const itemsToProcess = item_list && Array.isArray(item_list) ? item_list : [common_attr];

                itemsToProcess.forEach(commonAttrItem => {
                    if (!commonAttrItem) return;
                    const {common_attr} = commonAttrItem

                    let width = 0;
                    let height = 0;
                    if (commonAttrItem?.aigc_image_params){
                        width = commonAttrItem?.aigc_image_params?.text2image_params?.large_image_info?.width;
                        height = commonAttrItem?.aigc_image_params?.text2image_params?.large_image_info?.height;
                    }else if(task?.aigc_image_params){
                        width = task?.aigc_image_params?.text2image_params?.large_image_info?.width;
                        height = task?.aigc_image_params?.text2image_params?.large_image_info?.height;
                    }

                    if(!history_group_key){
                        history_group_key = commonAttrItem?.history_group_key || commonAttrItem?.description;
                    }
                    if (!created_time){
                        created_time = commonAttrItem?.created_time || commonAttrItem?.create_time;
                    }

                    let cover_url;
                    let cover_uri;
                    if (common_attr){
                        cover_url = common_attr?.cover_url;
                        cover_uri = common_attr?.cover_uri;
                    }else{
                        cover_url = commonAttrItem?.cover_url;
                        cover_uri = commonAttrItem?.cover_uri;
                    }



                    if (!cover_url || !cover_uri) return;

                    // 转换时间戳为日期格式
                    const date = new Date(Math.floor(created_time) * 1000).toISOString().split('T')[0];

                    if (!groupedData[history_group_key]) {
                        groupedData[history_group_key] = {};
                    }

                    if (!groupedData[history_group_key][date]) {
                        groupedData[history_group_key][date] = {};
                    }

                    // 创建分辨率键
                    const resolutionKey = width && height ? `${width}x${height}` : '未知尺寸';
                    if (!groupedData[history_group_key][date][resolutionKey]) {
                        groupedData[history_group_key][date][resolutionKey] = [];
                    }

                    groupedData[history_group_key][date][resolutionKey].push({
                        coverUrl: cover_url,
                        coverUri: cover_uri,
                        width: width,
                        height: height,
                    });
                });
            });

            updateButtonText();
        } catch (e) {
            console.error('Error processing response:', e);
        }
    };

    // 更新按钮文本
    const updateButtonText = () => {
        const downloadButton = document.getElementById('downloadImagesButton');
        if (downloadButton) {
            downloadButton.textContent = `选择下载 (共 ${Object.keys(groupedData).length} 个组)`;
        }
    };

    // 创建下载选择菜单
    const createSelectionMenu = () => {
        const menu = document.createElement('div');
        menu.id = 'selectionMenu';
        menu.style.position = 'fixed';
        menu.style.right = '20px';
        menu.style.bottom = '80px';
        menu.style.zIndex = '9999';
        menu.style.backgroundColor = '#fff';
        menu.style.border = '1px solid #ccc';
        menu.style.borderRadius = '5px';
        menu.style.padding = '10px';
        menu.style.maxHeight = '300px';
        menu.style.overflowY = 'auto';
        menu.style.display = 'none';

        document.body.appendChild(menu);
    };

    // 新增 CSV 导出函数
    const exportToCSV = (groupKey, date, resolution) => {
        const images = groupedData[groupKey][date][resolution] || [];
        let csvContent = "序号,图片链接,宽度,高度\n";
        
        images.forEach((image, index) => {
            csvContent += `${index + 1},${image.coverUrl},${image.width},${image.height}\n`;
        });

        // 创建 Blob 对象
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        // 创建下载链接
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${groupKey}_${date}_${resolution}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    // 修改 showSelectionMenu 函数中的显示逻辑
    const showSelectionMenu = () => {
        const menu = document.getElementById('selectionMenu');
        menu.innerHTML = '';
        if (menu.style.display === 'block') {
            menu.style.display = 'none';
            return;
        }

        Object.entries(groupedData).forEach(([groupKey, dates]) => {
            const groupDiv = document.createElement('div');
            groupDiv.style.marginBottom = '15px';

            const groupTitle = document.createElement('div');
            groupTitle.textContent = `组: ${groupKey}`;
            groupTitle.style.fontWeight = 'bold';
            groupDiv.appendChild(groupTitle);

            Object.entries(dates).forEach(([date, resolutions]) => {
                const dateDiv = document.createElement('div');
                dateDiv.style.marginLeft = '10px';
                dateDiv.style.marginTop = '5px';
                
                const dateTitle = document.createElement('div');
                dateTitle.textContent = `日期: ${date}`;
                dateTitle.style.fontWeight = 'bold';
                dateDiv.appendChild(dateTitle);

                Object.entries(resolutions).forEach(([resolution, images]) => {
                    const resolutionDiv = document.createElement('div');
                    resolutionDiv.style.display = 'flex';
                    resolutionDiv.style.alignItems = 'center';
                    resolutionDiv.style.margin = '5px';

                    // 下载图片按钮
                    const resolutionButton = document.createElement('button');
                    resolutionButton.textContent = `${resolution} (${images.length} 张)`;
                    resolutionButton.style.padding = '5px';
                    resolutionButton.style.backgroundColor = '#4CAF50';
                    resolutionButton.style.color = '#fff';
                    resolutionButton.style.border = 'none';
                    resolutionButton.style.borderRadius = '3px';
                    resolutionButton.style.cursor = 'pointer';
                    resolutionButton.style.marginRight = '5px';
                    resolutionButton.onclick = () => downloadImages(groupKey, date, resolution);

                    // 导出 CSV 按钮
                    const exportButton = document.createElement('button');
                    exportButton.textContent = '导出CSV';
                    exportButton.style.padding = '5px';
                    exportButton.style.backgroundColor = '#2196F3';
                    exportButton.style.color = '#fff';
                    exportButton.style.border = 'none';
                    exportButton.style.borderRadius = '3px';
                    exportButton.style.cursor = 'pointer';
                    exportButton.onclick = () => exportToCSV(groupKey, date, resolution);

                    resolutionDiv.appendChild(resolutionButton);
                    resolutionDiv.appendChild(exportButton);
                    dateDiv.appendChild(resolutionDiv);
                });

                groupDiv.appendChild(dateDiv);
            });

            menu.appendChild(groupDiv);
        });

        menu.style.display = 'block';
    };

    // 下载图片
    const downloadImages = (groupKey, date, resolution) => {
        const images = groupedData[groupKey][date][resolution] || [];
        images.forEach(({ coverUrl, coverUri }) => {
            const filename = `${date}_${resolution}_${coverUri}.webp`;
            GM_download({
                url: coverUrl,
                name: filename,
                onerror: (error) => console.error(`Failed to download ${filename}:`, error),
            });
        });
    };

    // 创建主下载按钮
    const createDownloadButton = () => {
        const button = document.createElement('button');
        button.id = 'downloadImagesButton';
        button.textContent = '选择下载';
        button.style.position = 'fixed';
        button.style.right = '20px';
        button.style.bottom = '20px';
        button.style.zIndex = '9999';
        button.style.padding = '10px 20px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = '#fff';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.fontSize = '14px';

        button.onclick = showSelectionMenu;
        document.body.appendChild(button);
    };

    // 确保文档加载完成
    const ensureDocumentReady = (callback) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    };

    // 初始化脚本
    const init = () => {
        console.log("Initializing script...");
        interceptXHR();
        ensureDocumentReady(() => {
            createDownloadButton();
            createSelectionMenu();
        });
    };

    init();
})();
