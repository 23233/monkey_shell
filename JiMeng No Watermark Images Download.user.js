// ==UserScript==
// @name         即梦图片视频无水印下载（聚合下载版）
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  按history_group_key聚合，再通过created_time按天聚合，再按分辨率进行聚合，并选择下载
// @author       23233
// @match        https://jimeng.jianying.com/*
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
                const {common_attr, item_list} = item;
                if (!common_attr && !item_list) return;

                let {history_group_key, created_time, generate_type} = item;
                generate_type = generate_type || (task?.first_generate_type || 1);

                // 如果item_list存在，则遍历item_list
                const itemsToProcess = item_list && Array.isArray(item_list) ? item_list : [common_attr];

                itemsToProcess.forEach(commonAttrItem => {
                    if (!commonAttrItem) return;
                    const {common_attr} = commonAttrItem;

                    let width = 0;
                    let height = 0;
                    let videoUrl = '';

                    if (generate_type === 10) { // 视频类型
                        const video = commonAttrItem?.video || common_attr?.video;
                        if (video?.transcoded_video?.origin?.video_url) {
                            videoUrl = video.transcoded_video.origin.video_url;
                            width = video.transcoded_video.origin.width;
                            height = video.transcoded_video.origin.height;
                        }
                    } else { // 图片类型
                        if (commonAttrItem?.aigc_image_params) {
                            width = commonAttrItem?.aigc_image_params?.text2image_params?.large_image_info?.width;
                            height = commonAttrItem?.aigc_image_params?.text2image_params?.large_image_info?.height;
                        } else if (task?.aigc_image_params) {
                            width = task?.aigc_image_params?.text2image_params?.large_image_info?.width;
                            height = task?.aigc_image_params?.text2image_params?.large_image_info?.height;
                        }
                    }

                    if (!history_group_key) {
                        history_group_key = commonAttrItem?.history_group_key || commonAttrItem?.description;
                    }
                    if (!created_time) {
                        created_time = commonAttrItem?.created_time || commonAttrItem?.create_time;
                    }

                    let cover_url;
                    let cover_uri;
                    if (common_attr) {
                        cover_url = common_attr?.cover_url;
                        cover_uri = common_attr?.cover_uri;
                    } else {
                        cover_url = commonAttrItem?.cover_url;
                        cover_uri = commonAttrItem?.cover_uri;
                    }

                    if ((!cover_url && !videoUrl) || (!cover_uri && !videoUrl)) return;

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
                        videoUrl: videoUrl,
                        width: width,
                        height: height,
                        type: generate_type === 10 ? 'video' : 'image'
                    });
                });
            });

            updateButtonText();
        } catch (e) {
            console.error('Error processing response:', e);
        }
    };

    const injectDownloadButtonsForVideos = () => {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.dataset.hasDownloadButton) return;
            video.dataset.hasDownloadButton = 'true';

            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.top = '5px';
            wrapper.style.left = '5px';
            wrapper.style.zIndex = '9999';

            const button = document.createElement('button');
            button.textContent = '⬇';
            button.title = '下载无水印视频';
            button.style.padding = '2px 5px';
            button.style.background = 'rgba(0,0,0,0.6)';
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '3px';
            button.style.cursor = 'pointer';
            button.style.fontSize = '14px';

            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const videoUrl = video.src;
                if (!videoUrl) return alert('未找到视频URL');

                // 从 URL 中提取 ID
                const match = location.pathname.match(/\/ai-tool\/work-detail\/(\d+)/);
                const filename = match ? `${match[1]}.mp4` : `video_${Date.now()}.mp4`;

                try {
                    const res = await fetch(videoUrl);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                } catch (err) {
                    console.error('下载失败', err);
                    alert('视频下载失败');
                }
            });

            wrapper.appendChild(button);
            video.style.position = 'relative';
            video.parentElement?.style.setProperty('position', 'relative', 'important');
            video.parentElement?.appendChild(wrapper);
        });
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
        menu.style.backgroundColor = '#fff';
        menu.style.border = '1px solid #ccc';
        menu.style.borderRadius = '5px';
        menu.style.padding = '10px';
        menu.style.display = 'none';
        menu.style.maxHeight = '400px';
        menu.style.overflowY = 'auto';
        menu.style.zIndex = '9998';

        // 遍历分组数据创建选项
        for (const groupKey in groupedData) {
            const groupDiv = document.createElement('div');
            groupDiv.style.marginBottom = '10px';

            const groupHeader = document.createElement('div');
            groupHeader.style.fontWeight = 'bold';
            groupHeader.style.marginBottom = '5px';
            groupHeader.textContent = groupKey;
            groupDiv.appendChild(groupHeader);

            for (const date in groupedData[groupKey]) {
                const dateDiv = document.createElement('div');
                dateDiv.style.marginLeft = '10px';
                dateDiv.style.marginBottom = '5px';

                const dateHeader = document.createElement('div');
                dateHeader.style.fontWeight = 'bold';
                dateHeader.textContent = date;
                dateDiv.appendChild(dateHeader);

                for (const resolution in groupedData[groupKey][date]) {
                    const items = groupedData[groupKey][date][resolution];
                    const isVideo = items[0]?.type === 'video';
                    const button = document.createElement('button');
                    button.style.marginLeft = '20px';
                    button.style.marginBottom = '5px';
                    button.style.padding = '5px 10px';
                    button.style.backgroundColor = '#4CAF50';
                    button.style.color = '#fff';
                    button.style.border = 'none';
                    button.style.borderRadius = '3px';
                    button.style.cursor = 'pointer';
                    button.style.fontSize = '12px';
                    button.textContent = `${resolution} (${items.length} ${isVideo ? '个' : '张'})`;
                    button.onclick = () => downloadImages(groupKey, date, resolution);
                    dateDiv.appendChild(button);
                }

                groupDiv.appendChild(dateDiv);
            }

            menu.appendChild(groupDiv);
        }

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

                    const isVideo = images[0]?.type === 'video';

                    // 下载图片按钮
                    const resolutionButton = document.createElement('button');
                    resolutionButton.textContent = `${resolution} (${images.length} ${isVideo ? '个' : '张'})`;
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

    // 通用的图片格式转换方法
    const convertWebpToPng = (imageUrl) => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const tempImg = new Image();

            tempImg.crossOrigin = 'anonymous';
            tempImg.onload = () => {
                canvas.width = tempImg.width;
                canvas.height = tempImg.height;
                ctx.drawImage(tempImg, 0, 0);

                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    resolve(url);
                }, 'image/png');
            };

            tempImg.onerror = reject;
            tempImg.src = imageUrl;
        });
    };

    // 修改下载图片方法
    const downloadImages = (groupKey, date, resolution) => {
        const items = groupedData[groupKey][date][resolution] || [];
        items.forEach(async (item, index) => {
            try {
                if (item.type === 'video') {
                    // 直接下载视频
                    const filename = `${groupKey}_${date}_${resolution}_${index + 1}.mp4`;
                    GM_download({
                        url: item.videoUrl,
                        name: filename,
                        onerror: (error) => console.error(`Failed to download ${filename}:`, error)
                    });
                } else {
                    // 图片处理保持不变
                    const pngUrl = await convertWebpToPng(item.coverUrl);
                    const filename = `${groupKey}_${date}_${resolution}_${index + 1}.png`;

                    GM_download({
                        url: pngUrl,
                        name: filename,
                        onerror: (error) => console.error(`Failed to download ${filename}:`, error),
                        onload: () => URL.revokeObjectURL(pngUrl)
                    });
                }
            } catch (error) {
                console.error('Error downloading:', error);
            }
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

    // 创建当前图片下载按钮
    const createCurrentImageButton = () => {
        const button = document.createElement('button');
        button.id = 'downloadCurrentImageButton';
        button.textContent = '下载当前图片';
        button.style.position = 'fixed';
        button.style.right = '20px';
        button.style.bottom = '50px';
        button.style.zIndex = '9999';
        button.style.padding = '10px 20px';
        button.style.backgroundColor = '#2196F3';
        button.style.color = '#fff';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.fontSize = '14px';
        button.style.display = 'none'; // 默认隐藏

        button.onclick = downloadCurrentImage;
        document.body.appendChild(button);
    };

    // 修改下载当前图片方法，使用新的转换函数
    const downloadCurrentImage = async () => {
        const img = document.querySelector('img[data-apm-action="record-detail-image-detail-image-container"]');
        if (img && img.src) {
            try {
                const pngUrl = await convertWebpToPng(img.src);
                const timestamp = Date.now();
                const filename = `${timestamp}.png`;

                GM_download({
                    url: pngUrl,
                    name: filename,
                    onerror: (error) => console.error(`Failed to download ${filename}:`, error),
                    onload: () => URL.revokeObjectURL(pngUrl)
                });
            } catch (error) {
                console.error('Error converting current image:', error);
            }
        }
    };

    // 监听DOM变化
    const observeDOM = () => {
        const targetNode = document.body;
        const config = { childList: true, subtree: true };

        const callback = (mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    // 查找所有元素节点，检查是否有包含"再次生成"文字的节点
                    const elements = document.getElementsByTagName('*');
                    const currentImageButton = document.getElementById('downloadCurrentImageButton');

                    for (const element of elements) {
                        if (element.childNodes.length === 1 &&
                            element.firstChild.nodeType === Node.TEXT_NODE &&
                            element.firstChild.textContent === '再次生成') {
                            currentImageButton.style.display = 'block';
                            return;
                        }
                    }

                    // 如果没找到包含"再次生成"的节点，隐藏按钮
                    if (currentImageButton) {
                        currentImageButton.style.display = 'none';
                    }
                }
            }
        };

        const observer = new MutationObserver(callback);
        observer.observe(targetNode, config);
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
            createCurrentImageButton(); // 添加当前图片下载按钮
            observeDOM(); // 添加DOM监听
        });
    };

    init();

    const startVideoMonitor = () => {
        const observer = new MutationObserver(() => injectDownloadButtonsForVideos());
        observer.observe(document.body, { childList: true, subtree: true });
        injectDownloadButtonsForVideos();
    };

    window.addEventListener('load', startVideoMonitor);

})();
