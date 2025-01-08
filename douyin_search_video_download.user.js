// ==UserScript==
// @name         抖音搜索页视频下载
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在抖音搜索页面展示视频并可以下载视频
// @author       23233
// @match        https://www.douyin.com/search/*
// @match        https://www.douyin.com/root/search/*
// @icon         https://p3-pc-weboff.byteimg.com/tos-cn-i-9r5gewecjs/logo-horizontal.svg
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // 存储不同 filter_selected 的视频数据
    let videoDataMap = new Map();
    let currentFilter = '';

    // 创建UI组件
    function createUI() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.bottom = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';

        // 创建切换按钮
        const toggleBtn = document.createElement('button');
        toggleBtn.innerHTML = '视频列表 <span style="font-size: 12px; margin-left: 5px;">(0)</span>';
        toggleBtn.style.padding = '10px 20px';
        toggleBtn.style.backgroundColor = '#FE2C55';
        toggleBtn.style.color = 'white';
        toggleBtn.style.border = 'none';
        toggleBtn.style.borderRadius = '4px';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.id = 'video-list-toggle';

        // 创建面板
        const panel = document.createElement('div');
        panel.style.display = 'none';
        panel.style.position = 'fixed';
        panel.style.bottom = '70px';
        panel.style.right = '20px';
        panel.style.width = '400px';
        panel.style.maxHeight = '600px';
        panel.style.backgroundColor = 'white';
        panel.style.borderRadius = '8px';
        panel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        panel.style.overflow = 'auto';
        panel.style.padding = '15px';

        toggleBtn.onclick = () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        };

        container.appendChild(toggleBtn);
        container.appendChild(panel);
        document.body.appendChild(container);

        return panel;
    }

    // 格式化时长
    function formatDuration(duration) {
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // 创建视频项
    function createVideoItem(data) {
        const item = document.createElement('div');
        item.style.borderBottom = '1px solid #eee';
        item.style.padding = '10px 0';
        item.style.marginBottom = '10px';
        item.style.position = 'relative';

        const desc = document.createElement('div');
        desc.textContent = data.desc;
        desc.style.fontSize = '14px';
        desc.style.marginBottom = '8px';
        desc.style.lineHeight = '1.4';
        desc.style.maxHeight = '2.8em';
        desc.style.overflow = 'hidden';
        desc.style.textOverflow = 'ellipsis';
        desc.style.display = '-webkit-box';
        desc.style.webkitLineClamp = '2';
        desc.style.webkitBoxOrient = 'vertical';
        desc.style.paddingRight = '80px';

        const stats = document.createElement('div');
        stats.style.fontSize = '12px';
        stats.style.color = '#666';
        stats.innerHTML = `
            收藏: ${data.statistics.collect_count} | 
            评论: ${data.statistics.comment_count} | 
            点赞: ${data.statistics.digg_count} | 
            播放: ${data.statistics.play_count}
        `;

        const videoInfo = document.createElement('div');
        videoInfo.style.fontSize = '12px';
        videoInfo.style.color = '#666';
        videoInfo.innerHTML = `
            尺寸: ${data.video.width}x${data.video.height} | 
            时长: ${formatDuration(data.video.duration)}
        `;

        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = '下载';
        downloadBtn.style.padding = '5px 10px';
        downloadBtn.style.backgroundColor = '#FE2C55';
        downloadBtn.style.color = 'white';
        downloadBtn.style.border = 'none';
        downloadBtn.style.borderRadius = '4px';
        downloadBtn.style.cursor = 'pointer';
        downloadBtn.style.position = 'absolute';
        downloadBtn.style.right = '0';
        downloadBtn.style.top = '10px';

        const progress = document.createElement('div');
        progress.style.display = 'none';
        progress.style.width = '100%';
        progress.style.height = '4px';
        progress.style.backgroundColor = '#eee';
        progress.style.marginTop = '5px';

        const progressBar = document.createElement('div');
        progressBar.style.width = '0%';
        progressBar.style.height = '100%';
        progressBar.style.backgroundColor = '#FE2C55';
        progress.appendChild(progressBar);

        downloadBtn.onclick = () => downloadVideo(data, progressBar, progress);

        item.appendChild(desc);
        item.appendChild(stats);
        item.appendChild(videoInfo);
        item.appendChild(downloadBtn);
        item.appendChild(progress);

        return item;
    }

    // 下载视频
    function downloadVideo(data, progressBar, progressDiv) {
        const videoUrl = data.video.play_addr.url_list.find(url => 
            url.startsWith('https://www.douyin.com/aweme/v1/play/'));
        
        if (!videoUrl) {
            alert('未找到可下载的视频地址');
            return;
        }

        progressDiv.style.display = 'block';
        
        GM_xmlhttpRequest({
            method: 'GET',
            url: videoUrl,
            responseType: 'blob',
            onprogress: (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    progressBar.style.width = percentComplete + '%';
                }
            },
            onload: (response) => {
                const url = URL.createObjectURL(response.response);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${data.desc.substring(0, 50)}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                progressDiv.style.display = 'none';
                progressBar.style.width = '0%';
            }
        });
    }

    // 解析URL参数
    function getQueryParams(url) {
        const params = {};
        const searchParams = new URLSearchParams(url.split('?')[1]);
        for (const [key, value] of searchParams) {
            params[key] = value;
        }
        return params;
    }

    // 添加更新按钮文本的函数
    function updateToggleButtonCount(count) {
        const toggleBtn = document.getElementById('video-list-toggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = `视频列表 <span style="font-size: 12px; margin-left: 5px;">(${count})</span>`;
        }
    }

    // 更新面板内容
    function updatePanel(videoList) {
        const panel = document.querySelector('#video-download-panel') || createUI();
        panel.id = 'video-download-panel';
        
        // 清空旧的内容
        panel.innerHTML = '';
        
        // 过滤并添加视频项
        const filteredList = videoList.filter(item => item.aweme_info && item.doc_type === 153);
        
        // 更新按钮上的数量
        updateToggleButtonCount(filteredList.length);
        
        // 添加视频项到面板
        filteredList.forEach(item => {
            const videoItem = createVideoItem(item.aweme_info);
            panel.appendChild(videoItem);
        });
    }

    // 修改拦截请求部分
    const originalXHR = unsafeWindow.XMLHttpRequest;
    function newXHR() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;

        xhr.open = function(method, url) {
            if (url.includes('/aweme/v1/web/general/search/single')) {
                const params = getQueryParams(url);
                const filterSelected = params.filter_selected || '';
                
                this.addEventListener('readystatechange', function() {
                    if (this.readyState === 4 && this.status === 200) {
                        try {
                            const response = JSON.parse(this.responseText);
                            if (response.data) {
                                if (currentFilter !== filterSelected) {
                                    // 如果 filter 变化，清空之前的数据
                                    videoDataMap.clear();
                                    currentFilter = filterSelected;
                                }

                                // 获取现有数据
                                let existingData = videoDataMap.get(filterSelected) || [];
                                
                                // 合并新数据，只保留 doc_type 为 153 的数据
                                const newData = response.data.filter(item => item.doc_type === 153);
                                const mergedData = [...existingData, ...newData];
                                
                                // 更新存储的数据
                                videoDataMap.set(filterSelected, mergedData);
                                
                                // 更新面板显示
                                updatePanel(mergedData);
                            }
                        } catch (e) {}
                    }
                });
            }
            originalOpen.apply(this, arguments);
        };

        xhr.send = function() {
            originalSend.apply(this, arguments);
        };

        return xhr;
    }

    unsafeWindow.XMLHttpRequest = newXHR;
})();