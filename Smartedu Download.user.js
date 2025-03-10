// ==UserScript==
// @name         Smartedu PDF Downloader
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Download PDFs from basic.smartedu.cn
// @author       23233
// @match        https://basic.smartedu.cn/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      ykt.cbern.com.cn
// ==/UserScript==

(function () {
    'use strict';

    // 只在教材详情页面运行
    if (!location.pathname.includes('tchMaterial/detail')) {
        return;
    }

    // 创建下载按钮和进度条
    function createDownloadButton() {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
        `;

        // 创建按钮和选项的容器
        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = `
            display: flex;
            gap: 10px;
            align-items: center;
        `;

        const button = document.createElement('button');
        button.innerHTML = '下载PDF';
        button.style.cssText = `
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            width: 120px;
        `;

        // 创建音频下载按钮
        const audioButton = document.createElement('button');
        audioButton.innerHTML = '仅下载音频';
        audioButton.style.cssText = `
            padding: 10px 20px;
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            width: 120px;
            display: none;  // 默认隐藏
        `;

        // 创建下载后处理选项
        const selectContainer = document.createElement('div');
        selectContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
        `;

        const selectLabel = document.createElement('label');
        selectLabel.textContent = '下载后:';
        selectLabel.style.cssText = `
            color: #666;
            font-size: 12px;
        `;

        const select = document.createElement('select');
        select.style.cssText = `
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-size: 12px;
            background-color: white;
            cursor: pointer;
        `;

        const options = [
            {value: 'none', text: '不处理'},
            {value: 'close', text: '关闭页面'}
        ];

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            select.appendChild(option);
        });

        // 保存用户选择
        select.value = localStorage.getItem('pdfDownloadAction') || 'none';
        select.addEventListener('change', () => {
            localStorage.setItem('pdfDownloadAction', select.value);
        });

        selectContainer.appendChild(selectLabel);
        selectContainer.appendChild(select);
        buttonRow.appendChild(button);
        buttonRow.appendChild(audioButton);
        buttonRow.appendChild(selectContainer);

        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            width: 120px;
            height: 4px;
            background-color: #ddd;
            border-radius: 2px;
            overflow: hidden;
            display: none;
        `;

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `
            width: 0%;
            height: 100%;
            background-color: #4CAF50;
            transition: width 0.3s ease;
        `;

        const progressText = document.createElement('div');
        progressText.style.cssText = `
            font-size: 12px;
            color: #666;
            text-align: center;
            display: none;
        `;

        progressContainer.appendChild(progressBar);
        container.appendChild(buttonRow);
        container.appendChild(progressContainer);
        container.appendChild(progressText);

        // 保存元素引用
        container.progressBar = progressBar;
        container.progressContainer = progressContainer;
        container.progressText = progressText;
        container.button = button;
        container.audioButton = audioButton;
        container.select = select;

        return container;
    }

    // 更新下载按钮状态
    function updateButtonStatus(container, status, progress = '') {
        const button = container.button;
        const progressContainer = container.progressContainer;
        const progressText = container.progressText;

        const statusText = {
            ready: '下载PDF',
            preloading: `正在预加载页面...${progress}`,
            downloading: '正在下载PDF...',
        };

        button.innerHTML = statusText[status];
        button.disabled = status !== 'ready';
        button.style.backgroundColor = status === 'ready' ? '#4CAF50' : '#888888';

        // 显示或隐藏进度条
        progressContainer.style.display = status === 'downloading' ? 'block' : 'none';
        progressText.style.display = status === 'downloading' ? 'block' : 'none';
    }

    // 更新下载进度
    function updateDownloadProgress(container, progress) {
        const progressBar = container.progressBar;
        const progressText = container.progressText;

        // 更新进度条
        progressBar.style.width = `${progress}%`;
        // 更新进度文本
        progressText.textContent = `${progress.toFixed(1)}%`;
    }

    // 获取文件名
    async function getFileName() {
        // 首先尝试从页面获取标题
        const titleElement = document.querySelector('h3[class*="index-module_title"]');
        if (titleElement) {
            return titleElement.textContent.trim();
        }

        // 如果页面上没有标题，从API获取
        const urlParams = new URLSearchParams(window.location.search);
        const contentId = urlParams.get('contentId');
        if (!contentId) return 'download.pdf';

        try {
            const response = await fetch(`https://s-file-2.ykt.cbern.com.cn/zxx/ndrv2/resources/tch_material/details/${contentId}.json`);
            const data = await response.json();
            return data.title || 'download.pdf';
        } catch (error) {
            console.error('获取文件名失败:', error);
            return 'download.pdf';
        }
    }

    // 创建并下载txt文件
    async function downloadTxtFile(fileName, contentId) {
        try {
            const currentUrl = window.location.href;
            const apiUrl = `https://s-file-2.ykt.cbern.com.cn/zxx/ndrv2/resources/tch_material/details/${contentId}.json`;
            const content = `${currentUrl}\n${apiUrl}`;
            const txtFileName = `${fileName}_${contentId}.txt`;

            const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = txtFileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error('txt文件下载失败:', error);
        }
    }

    // 从URL中提取PDF信息
    function extractPdfInfo(iframeUrl) {
        try {
            const url = new URL(iframeUrl);
            const pdfUrl = url.searchParams.get('file');
            const headersStr = url.searchParams.get('headers');

            if (!pdfUrl || !headersStr) {
                return null;
            }

            // 解析headers参数
            const headers = JSON.parse(headersStr);
            return {
                pdfUrl,
                authHeader: headers['X-ND-AUTH']
            };
        } catch (error) {
            console.error('提取PDF信息失败:', error);
            return null;
        }
    }

    // 处理下载完成后的操作
    async function handlePostDownload(container) {
        const action = container.select.value;
        if (action === 'close') {
            // 等待一小段时间确保文件开始下载
            await new Promise(resolve => setTimeout(resolve, 1000));
            window.close();
        }
    }

    // 直接下载PDF文件
    async function directDownloadPDF(pdfUrl, authHeader, fileName) {
        return new Promise((resolve, reject) => {
            console.log('开始直接下载PDF:', pdfUrl);
            GM_xmlhttpRequest({
                method: 'GET',
                url: pdfUrl,
                headers: {
                    'X-ND-AUTH': authHeader
                },
                responseType: 'blob',
                onprogress: function (progress) {
                    if (progress.lengthComputable) {
                        const percentComplete = (progress.loaded / progress.total) * 100;
                        updateDownloadProgress(window._downloadButton, percentComplete);
                    }
                },
                onload: async function (response) {
                    if (response.status === 200) {
                        updateDownloadProgress(window._downloadButton, 100);
                        const blob = new Blob([response.response], {type: 'application/pdf'});
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${fileName}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        a.remove();

                        resolve();
                    } else {
                        reject(new Error('PDF下载失败: ' + response.status));
                    }
                },
                onerror: function (error) {
                    reject(new Error('PDF下载请求失败: ' + error));
                }
            });
        });
    }

    // 下载音频文件
    async function downloadAudio(url, fileName, itemName, authHeader) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: {
                    'X-ND-AUTH': authHeader
                },
                responseType: 'blob',
                onload: function (response) {
                    if (response.status === 200) {
                        const blob = new Blob([response.response], {type: 'audio/mpeg'});
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${fileName}_${itemName}.mp3`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        a.remove();
                        resolve();
                    } else {
                        reject(new Error('音频下载失败: ' + response.status));
                    }
                },
                onerror: function (error) {
                    reject(new Error('音频下载请求失败: ' + error));
                }
            });
        });
    }

    // 处理音频资源下载
    async function handleAudioDownload(fileName, authHeader) {
        const audioListWrapper = document.querySelector('div[class*="audioList-module_audio-list-wrapper"]');
        if (!audioListWrapper) return;

        const audioItems = document.querySelectorAll('div[class*="audioList-module_audio-item"]');
        if (!audioItems.length) return;

        console.log('发现音频资源，开始下载...');

        // 创建一个用于存储音频URL的Map
        const audioUrlMap = new Map();

        // 创建XHR请求拦截器
        const originalXHR = unsafeWindow.XMLHttpRequest;
        unsafeWindow.XMLHttpRequest = function () {
            const xhr = new originalXHR();
            const originalOpen = xhr.open;

            xhr.open = function () {
                const url = arguments[1];
                if (url && url.includes('.mp3')) {
                    xhr.addEventListener('load', function () {
                        if (xhr.status === 200) {
                            audioUrlMap.set(currentAudioItem, url);
                        }
                    });
                }
                originalOpen.apply(this, arguments);
            };

            return xhr;
        };

        let currentAudioItem = null;
        for (const item of audioItems) {
            try {
                const audioName = item.querySelector('div[class*="audioList-module_center"]')?.textContent.trim() || '未命名音频';
                currentAudioItem = item;
                item.click();

                await new Promise((resolve, reject) => {
                    const checkUrl = () => {
                        const url = audioUrlMap.get(item);
                        if (url) {
                            resolve(url);
                        } else {
                            setTimeout(checkUrl, 100);
                        }
                    };
                    checkUrl();
                    setTimeout(() => reject(new Error('获取音频URL超时')), 5000);
                }).then(async (url) => {
                    await downloadAudio(url, fileName, audioName, authHeader);
                });

                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`下载音频 "${audioName}" 失败:`, error);
            }
        }

        unsafeWindow.XMLHttpRequest = originalXHR;
    }

    // 监听iframe加载
    function watchIframe() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.tagName === 'IFRAME') {
                        if (node.src.includes('/pdfjs/') || node.src.includes('x-edu-pdfjs.ykt.eduyun.cn')) {
                            const buttonContainer = createDownloadButton();
                            document.body.appendChild(buttonContainer);
                            window._downloadButton = buttonContainer;

                            const pdfInfo = extractPdfInfo(node.src);
                            if (pdfInfo) {
                                console.log('发现可直接下载的PDF');
                                updateButtonStatus(buttonContainer, 'ready');

                                // 检查是否存在音频资源
                                const hasAudio = document.querySelector('div[class*="audioList-module_audio-list-wrapper"]');
                                if (hasAudio) {
                                    buttonContainer.audioButton.style.display = 'block';
                                    
                                    // 设置音频按钮点击事件
                                    buttonContainer.audioButton.onclick = async () => {
                                        try {
                                            const fileName = await getFileName();
                                            updateButtonStatus(buttonContainer, 'downloading');
                                            await handleAudioDownload(fileName, pdfInfo.authHeader);
                                            updateButtonStatus(buttonContainer, 'ready');
                                            await handlePostDownload(window._downloadButton);
                                        } catch (error) {
                                            console.error('音频下载失败:', error);
                                            alert('音频下载失败，请重试');
                                            updateButtonStatus(buttonContainer, 'ready');
                                        }
                                    };
                                }

                                // 原有的PDF下载按钮点击事件
                                buttonContainer.button.onclick = async () => {
                                    try {
                                        const fileName = await getFileName();
                                        const urlParams = new URLSearchParams(window.location.search);
                                        const contentId = urlParams.get('contentId');

                                        updateButtonStatus(buttonContainer, 'downloading');
                                        await directDownloadPDF(pdfInfo.pdfUrl, pdfInfo.authHeader, fileName);
                                        await handleAudioDownload(fileName, pdfInfo.authHeader);
                                        await downloadTxtFile(fileName, contentId);
                                        updateButtonStatus(buttonContainer, 'ready');
                                        
                                        await handlePostDownload(window._downloadButton);
                                    } catch (error) {
                                        console.error('直接下载失败:', error);
                                        alert('直接下载失败，将尝试预加载方式');
                                        updateButtonStatus(buttonContainer, 'ready');
                                    }
                                };
                                observer.disconnect();
                                return;
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 启动监听
    watchIframe();
})();