// ==UserScript==
// @name         抖音视频下载助手
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  在抖音视频页面添加下载按钮
// @author       23233
// @match        https://www.douyin.com/video/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 添加视频URL存储
    let videoUrlFromApi = null;

    // 立即执行请求拦截
    console.log("开始执行请求拦截");
    interceptApiRequest();

    // 添加请求拦截逻辑
    function interceptApiRequest() {
        const originalXHR = unsafeWindow.XMLHttpRequest;
        
        unsafeWindow.XMLHttpRequest = new Proxy(originalXHR, {
            construct: function(target, args) {
                const xhr = new target(...args);
                
                // 代理 open 方法
                const originalOpen = xhr.open;
                xhr.open = function() {
                    if (arguments[1].includes('/aweme/v1/web/aweme/detail')) {
                        console.log('检测到XHR目标请求:', arguments[1]);
                        
                        // 保存原始的 onreadystatechange
                        const originalStateChange = xhr.onreadystatechange;
                        xhr.onreadystatechange = function() {
                            // 先调用原始的回调
                            if (originalStateChange) {
                                originalStateChange.apply(this, arguments);
                            }
                            
                            if (xhr.readyState === 4 && xhr.status === 200) {
                                // console.log('响应内容:', xhr.responseText);
                                try {
                                    const response = JSON.parse(xhr.responseText);
                                    handleApiResponse(response);
                                } catch (error) {
                                    console.error('解析XHR响应失败:', error);
                                }
                            }
                        };
                    }
                    return originalOpen.apply(xhr, arguments);
                };
                
                return xhr;
            }
        });

        // 拦截 fetch 请求
        const originalFetch = unsafeWindow.fetch;
        unsafeWindow.fetch = function(input, init) {
            const url = typeof input === 'string' ? input : input.url;
            
            if (url.includes('/aweme/v1/web/aweme/detail')) {
                console.log('检测到fetch目标请求:', url);
                
                return originalFetch.apply(this, arguments)
                    .then(response => response.clone().json()
                        .then(data => {
                            handleApiResponse(data);
                            return response;
                        })
                        .catch(error => {
                            console.error('解析fetch响应失败:', error);
                            return response;
                        })
                    );
            }
            
            return originalFetch.apply(this, arguments);
        };

        // 统一处理响应数据
        function handleApiResponse(response) {
            try {
                const urlList = response?.aweme_detail?.video?.play_addr?.url_list;
                if (urlList && Array.isArray(urlList)) {
                    const playUrl = urlList.find(url => url.includes('/aweme/v1/play/'));
                    if (playUrl) {
                        videoUrlFromApi = playUrl;
                        console.log('已获取到视频URL:', videoUrlFromApi);
                    }
                }
            } catch (error) {
                console.error('处理响应数据失败:', error);
            }
        }
    }

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

    // 创建复制链接按钮
    function createCopyButton() {
        const button = document.createElement('button');
        button.innerHTML = '复制视频链接';
        button.style.cssText = `
            position: fixed;
            bottom: 60px;  // 位于下载按钮上方
            right: 20px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #2c8afe;  // 使用不同的颜色区分
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        button.addEventListener('click', copyVideoUrl);
        document.body.appendChild(button);
    }

    // 复制视频链接函数
    function copyVideoUrl() {
        const videoElement = document.querySelector('video[data-xgplayerid]');
        if (!videoElement) {
            alert('未找到视频元素');
            return;
        }

        const sources = videoElement.getElementsByTagName('source');
        const lastSource = sources[sources.length - 1];
        
        if (!lastSource || !lastSource.src) {
            alert('未找到视频源');
            return;
        }

        navigator.clipboard.writeText(lastSource.src)
            .then(() => alert('视频链接已复制到剪贴板'))
            .catch(err => alert('复制失败: ' + err));
    }

    // 修改下载视频函数
    function downloadVideo() {
        if (videoUrlFromApi) {
            console.log('使用API获取的URL下载视频:', videoUrlFromApi);
            const videoId = window.location.pathname.split('/').pop().split('?')[0];
            const fileName = `${videoId}.mp4`;
            
            tryGMDownload(videoUrlFromApi, fileName)
                .catch((error) => {
                    console.log('GM_download 失败，错误:', error);
                    return tryXHRDownload(videoUrlFromApi, fileName);
                })
                .catch((error) => {
                    console.log('GM_xmlhttpRequest 失败，错误:', error);
                    return copyToClipboardAndNotify(videoUrlFromApi);
                });
        } else {
            // 如果没有从API获取到URL，使用原来的逻辑
            const videoElement = document.querySelector('video[data-xgplayerid]');
            
            if (!videoElement) {
                alert('未找到视频元素');
                return;
            }

            const sources = videoElement.getElementsByTagName('source');
            const lastSource = sources[sources.length - 1];
            
            if (!lastSource || !lastSource.src) {
                alert('未找到视频源');
                return;
            }

            const videoId = window.location.pathname.split('/').pop().split('?')[0];
            const fileName = `${videoId}.mp4`;
            const videoUrl = lastSource.src;

            console.log('开始下载视频:', {
                url: videoUrl,
                fileName: fileName,
                GM_download: typeof GM_download,
                GM_xmlhttpRequest: typeof GM_xmlhttpRequest
            });

            // 尝试使用 GM_download
            tryGMDownload(videoUrl, fileName)
                .catch((error) => {
                    console.log('GM_download 失败，错误:', error);
                    console.log('尝试使用 GM_xmlhttpRequest');
                    return tryXHRDownload(videoUrl, fileName);
                })
                .catch((error) => {
                    console.log('GM_xmlhttpRequest 失败，错误:', error);
                    console.log('复制链接到剪贴板');
                    return copyToClipboardAndNotify(videoUrl);
                });
        }
    }

    // 创建进度条UI
    function createProgressBar() {
        const progressDiv = document.createElement('div');
        progressDiv.id = 'download-progress';
        progressDiv.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            width: 300px;
            background: rgba(0,0,0,0.8);
            padding: 15px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            z-index: 9999;
            display: none;
        `;

        const statusText = document.createElement('div');
        statusText.id = 'progress-status';
        statusText.style.marginBottom = '10px';

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 100%;
            height: 4px;
            background: #444;
            border-radius: 2px;
        `;

        const progressFill = document.createElement('div');
        progressFill.id = 'progress-fill';
        progressFill.style.cssText = `
            width: 0%;
            height: 100%;
            background: #2196F3;
            border-radius: 2px;
            transition: width 0.3s ease;
        `;

        progressBar.appendChild(progressFill);
        progressDiv.appendChild(statusText);
        progressDiv.appendChild(progressBar);
        document.body.appendChild(progressDiv);

        return {
            show: () => progressDiv.style.display = 'block',
            hide: () => progressDiv.style.display = 'none',
            updateProgress: (percent, status) => {
                progressFill.style.width = `${percent}%`;
                statusText.textContent = status || `下载进度: ${percent.toFixed(1)}%`;
            }
        };
    }

    // 修改 GM_xmlhttpRequest 下载方案
    function tryXHRDownload(url, fileName) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') {
                reject(new Error('GM_xmlhttpRequest not available'));
                return;
            }

            const progress = createProgressBar();
            progress.show();
            progress.updateProgress(0, '准备下载...');

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                onprogress: (event) => {
                    if (event.lengthComputable) {
                        const percent = (event.loaded / event.total) * 100;
                        const downloaded = (event.loaded / 1024 / 1024).toFixed(1);
                        const total = (event.total / 1024 / 1024).toFixed(1);
                        progress.updateProgress(
                            percent,
                            `下载中: ${downloaded}MB / ${total}MB (${percent.toFixed(1)}%)`
                        );
                    }
                },
                onload: function(response) {
                    try {
                        progress.updateProgress(100, '下载完成，准备保存...');
                        const blob = response.response;
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = fileName;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                        setTimeout(() => progress.hide(), 2000);
                        resolve();
                    } catch (error) {
                        progress.updateProgress(0, '下载失败');
                        setTimeout(() => progress.hide(), 2000);
                        reject(error);
                    }
                },
                onerror: (error) => {
                    progress.updateProgress(0, '下载失败');
                    setTimeout(() => progress.hide(), 2000);
                    reject(error);
                },
                ontimeout: () => {
                    progress.updateProgress(0, '下载超时');
                    setTimeout(() => progress.hide(), 2000);
                    reject(new Error('XHR timeout'));
                }
            });
        });
    }

    // 修改 GM_download 下载方案
    function tryGMDownload(url, fileName) {
        return new Promise((resolve, reject) => {
            if (typeof GM_download !== 'function') {
                reject(new Error('GM_download not available'));
                return;
            }

            const progress = createProgressBar();
            progress.show();
            progress.updateProgress(0, '准备下载...');

            const timeout = setTimeout(() => {
                progress.updateProgress(0, 'GM_download 超时，切换下载方式...');
                setTimeout(() => progress.hide(), 2000);
                reject(new Error('GM_download timeout - no response'));
            }, 3000);

            try {
                GM_download({
                    url: url,
                    name: fileName,
                    onprogress: (event) => {
                        if (event && event.lengthComputable) {
                            const percent = (event.loaded / event.total) * 100;
                            const downloaded = (event.loaded / 1024 / 1024).toFixed(1);
                            const total = (event.total / 1024 / 1024).toFixed(1);
                            progress.updateProgress(
                                percent,
                                `下载中: ${downloaded}MB / ${total}MB (${percent.toFixed(1)}%)`
                            );
                        }
                    },
                    onload: () => {
                        clearTimeout(timeout);
                        progress.updateProgress(100, '下载完成！');
                        setTimeout(() => progress.hide(), 2000);
                        resolve();
                    },
                    onerror: (error) => {
                        clearTimeout(timeout);
                        progress.updateProgress(0, '下载失败');
                        setTimeout(() => progress.hide(), 2000);
                        reject(error);
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                progress.updateProgress(0, '下载失败');
                setTimeout(() => progress.hide(), 2000);
                reject(error);
            }
        });
    }

    // 复制到剪贴板并通知用户
    function copyToClipboardAndNotify(url) {
        return navigator.clipboard.writeText(url)
            .then(() => {
                alert('下载失败，视频链接已复制到剪贴板，请使用下载工具下载');
                console.log('已复制链接:', url);
            })
            .catch(err => {
                alert('复制链接失败: ' + err);
                console.error('复制失败:', err);
                throw err;
            });
    }

    // 添加下载状态提示
    function updateDownloadStatus(message) {
        const statusDiv = document.getElementById('download-status') || (() => {
            const div = document.createElement('div');
            div.id = 'download-status';
            div.style.cssText = `
                position: fixed;
                bottom: 100px;
                right: 20px;
                padding: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                border-radius: 4px;
                z-index: 9999;
            `;
            document.body.appendChild(div);
            return div;
        })();
        statusDiv.textContent = message;
        
        // 5秒后自动隐藏
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }

    // 修改页面加载完成后的处理
    window.addEventListener('load', () => {
        console.log("页面加载完成");
        setTimeout(() => {
            createDownloadButton();
            createCopyButton();
        }, 2000);
    });
})(); 