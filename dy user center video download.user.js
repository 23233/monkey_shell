// ==UserScript==
// @name         抖音主页视频下载
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  拦截请求并下载抖音视频，显示界面选择下载
// @author       23233
// @match        https://www.douyin.com/user/*
// @icon         https://p3-pc-weboff.byteimg.com/tos-cn-i-9r5gewecjs/logo-horizontal.svg
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    let videoList = [];
    let count = 0;

    // 获取当前时间作为标题
    function fileName() {
        const now = new Date();
        return `video_${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
    }

    // 创建并插入 Toast 容器
    const toastContainer = document.createElement("div");
    toastContainer.style.position = "fixed";
    toastContainer.style.bottom = "10px";
    toastContainer.style.left = "50%";
    toastContainer.style.transform = "translateX(-50%)";
    toastContainer.style.zIndex = "1000";
    toastContainer.style.display = "flex";
    toastContainer.style.flexDirection = "column";
    toastContainer.style.alignItems = "center";
    toastContainer.style.gap = "10px";
    document.body.appendChild(toastContainer);

    // 显示 Toast 消息函数
    function showToast(message) {
        const toast = document.createElement("div");
        toast.innerText = message;
        toast.style.backgroundColor = "black";
        toast.style.color = "white";
        toast.style.padding = "10px";
        toast.style.borderRadius = "5px";
        toast.style.opacity = "1";
        toast.style.transition = "opacity 0.5s";

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toastContainer.removeChild(toast), 500);
        }, 3000);
    }


    // 插入控制面板
    function insertControlPanel() {
        const panelContainer = document.createElement("div");
        panelContainer.id = "panelContainer";
        panelContainer.style.position = "fixed";
        panelContainer.style.bottom = "60px";
        panelContainer.style.right = "10px";
        panelContainer.style.zIndex = 1000;
        panelContainer.style.maxHeight = "50vh";
        panelContainer.style.width = "360px";
        panelContainer.style.overflowY = "auto";
        panelContainer.style.backgroundColor = "white";
        panelContainer.style.border = "1px solid #ccc";
        panelContainer.style.borderRadius = "5px";
        panelContainer.style.display = "none";

        const panel = document.createElement("div");
        panel.id = "controlPanel";
        panel.style.display = "none";
        panel.style.padding = "10px";
        panel.style.paddingTop = "50px"; // Space for fixed buttons
        panel.style.boxSizing = "border-box";
        panel.style.overflowY = "auto";
        panel.style.maxHeight = "calc(50vh - 60px)"; // Subtract space for buttons and padding
        panelContainer.appendChild(panel);

        const toggleButton = document.createElement("button");
        toggleButton.id = "dy_video_download_toggle_btn";
        toggleButton.innerHTML = "展开 (0)";
        toggleButton.style.margin = "10px";
        toggleButton.style.position = "fixed";
        toggleButton.style.bottom = "10px";
        toggleButton.style.right = "10px";
        toggleButton.style.zIndex = 1001;
        toggleButton.style.backgroundColor = "#007bff";
        toggleButton.style.color = "white";
        toggleButton.style.border = "none";
        toggleButton.style.borderRadius = "5px";
        toggleButton.style.padding = "10px";
        toggleButton.style.cursor = "pointer";
        toggleButton.addEventListener("click", () => {
            const panel = document.getElementById("controlPanel");
            const isHidden = panel.style.display === "none";
            panel.style.display = isHidden ? "block" : "none";
            panelContainer.style.display = isHidden ? "block" : "none";
            updateToggleButtonText();
        });

        const buttonContainer = document.createElement("div");
        buttonContainer.style.position = "absolute";
        buttonContainer.style.top = "0";
        buttonContainer.style.right = "10px";
        buttonContainer.style.zIndex = 1001;
        buttonContainer.style.backgroundColor = "white";
        buttonContainer.style.width = "330px";
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "space-between";
        buttonContainer.style.padding = "3px";
        buttonContainer.style.borderTop = "1px solid #ccc";

        // 修改按钮样式
        const buttonStyles = {
            flex: "1",
            marginRight: "3px",
            marginLeft: "3px",
            color: "white",
            border: "none",
            borderRadius: "3px",
            padding: "5px",
            cursor: "pointer",
            fontSize: "12px"
        };

        // 添加复制信息按钮
        const copyInfoButton = document.createElement("button");
        copyInfoButton.innerHTML = "复制信息";
        Object.assign(copyInfoButton.style, buttonStyles);
        copyInfoButton.style.backgroundColor = "#17a2b8";
        copyInfoButton.addEventListener("click", copyUserInfo);

        const downloadAllButton = document.createElement("button");
        downloadAllButton.innerHTML = "下载全部";
        Object.assign(downloadAllButton.style, buttonStyles);
        downloadAllButton.style.backgroundColor = "#28a745";
        downloadAllButton.addEventListener("click", downloadAll);

        const downloadSelectedButton = document.createElement("button");
        downloadSelectedButton.innerHTML = "下载选中";
        Object.assign(downloadSelectedButton.style, buttonStyles);
        downloadSelectedButton.style.backgroundColor = "#ffc107";
        downloadSelectedButton.addEventListener("click", downloadSelected);

        // 清空全部
        const clearAllButton = document.createElement("button");
        clearAllButton.innerHTML = "清空全部";
        Object.assign(clearAllButton.style, buttonStyles);
        clearAllButton.style.backgroundColor = "#dc3545";
        clearAllButton.addEventListener("click", () => {
            videoList = [];
            panel.innerHTML = "";
            count = 0;
        });

        // 清空选中
        const clearSelectedButton = document.createElement("button");
        clearSelectedButton.innerHTML = "清空选中";
        Object.assign(clearSelectedButton.style, buttonStyles);
        clearSelectedButton.style.backgroundColor = "#f15050";
        clearSelectedButton.addEventListener("click", () => {
            videoList = videoList.filter(video => !video.checkbox.checked);
            panel.innerHTML = "";
            videoList.forEach(video => panel.appendChild(video.checkbox.parentNode));
            // 对序号重新排序
            count = 0;
            videoList.forEach(video => {
                video.checkbox.checked = false;
                video.title = ++count + "_" + video.title.split("_")[1];
            });
        });

        buttonContainer.appendChild(copyInfoButton);
        buttonContainer.appendChild(downloadAllButton);
        buttonContainer.appendChild(downloadSelectedButton);
        buttonContainer.appendChild(clearAllButton);
        buttonContainer.appendChild(clearSelectedButton);

        panelContainer.appendChild(buttonContainer);
        document.body.appendChild(panelContainer);
        document.body.appendChild(toggleButton);
    }

    // 插入视频信息
    function insertVideoInfo(title, url) {

        // 如果视频已经存在，则不再插入
        if (videoList.some(video => video.url === url || (title && video.title === title))) {
            return;
        }
        const panel = document.getElementById("controlPanel");

        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.marginBottom = "10px";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.style.marginRight = "10px";

        const link = document.createElement("a");
        if (!title) title = fileName();
        title = ++count + "_" + title;
        link.href = url;
        link.innerText = title;
        link.target = "_blank";
        link.style.flex = "1";
        // 设置样式只显示一行，超出部分用省略号代替
        link.style.whiteSpace = "nowrap";
        link.style.overflow = "hidden";
        link.style.textOverflow = "ellipsis";

        container.appendChild(checkbox);
        container.appendChild(link);

        panel.appendChild(container);

        videoList.push({checkbox, title: title, url, id: url.split('/')[4]});
        updateToggleButtonText();
    }

    function insertImageInfo(title, images) {
        // 如果没有图片，则不处理
        if (!images || images.length === 0) {
            return;
        }

        // 创建一个唯一标识，使用第一张图片的URL
        const imageId = images[0].url;

        // 如果图片组已经存在，则不再插入
        if (videoList.some(item => item.id === imageId)) {
            return;
        }

        const panel = document.getElementById("controlPanel");

        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.marginBottom = "10px";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.style.marginRight = "10px";

        const link = document.createElement("a");
        if (!title) title = fileName();
        title = ++count + "_" + title;
        link.href = images[0].url; // 链接到第一张图片
        link.innerText = title;
        link.target = "_blank";
        link.style.color = "red"
        link.title = "图文" + images.length + "张"
        link.style.flex = "1";
        // 设置样式只显示一行，超出部分用省略号代替
        link.style.whiteSpace = "nowrap";
        link.style.overflow = "hidden";
        link.style.textOverflow = "ellipsis";

        container.appendChild(checkbox);
        container.appendChild(link);

        panel.appendChild(container);

        videoList.push({
            checkbox,
            title: title,
            url: images[0].url,
            id: imageId,
            isImageGroup: true,
            images: images
        });
        updateToggleButtonText();
    }

    // 下载所有视频
    function downloadAll() {
        videoList.forEach(video => processDownload(video));
    }

    // 下载选中的视频
    function downloadSelected() {
        videoList.forEach(video => {
            if (video.checkbox.checked) {
                processDownload(video);
            }
        });
    }

    // 处理下载单个项目
    function processDownload(item) {
        if (item?.isImageGroup) {
            // 这是图文 遍历images
            item.images.forEach((d, i) => {
                // 创建唯一标识符，确保不会重复下载
                const uniqueUrl = d.url;
                const uniqueTitle = item.title + "_" + (i + 1);

                // 检查是否已在下载队列中
                if (downloadQueue.downloading.has(uniqueUrl)) {
                    showToast(`图片 ${uniqueTitle} 已在下载队列中`);
                    return;
                }

                downloadQueue.add({
                    title: uniqueTitle,
                    url: uniqueUrl,
                    isImage: true
                });
            });
        } else {
            // 这是视频
            let videoUrl = item.url;
            // 确保 URL 使用 HTTPS
            if (!videoUrl.startsWith('https://')) {
                videoUrl = videoUrl.replace('http://', 'https://');
            }
            // 如果视频已在下载队列中，则跳过
            if (downloadQueue.downloading.has(videoUrl)) {
                showToast("该视频已在下载队列中");
                return;
            }
            downloadQueue.add({...item, url: videoUrl});
        }
    }


    // 下载队列管理器
    class DownloadQueue {
        constructor(maxConcurrent = 5) {
            this.maxConcurrent = maxConcurrent;
            this.currentDownloads = 0;
            this.queue = [];
            this.downloading = new Set();
        }

        // 添加下载任务到队列
        add(video) {
            this.queue.push(video);
            this.processQueue();
        }

        // 处理队列
        processQueue() {
            if (this.currentDownloads >= this.maxConcurrent || this.queue.length === 0) {
                return;
            }

            while (this.currentDownloads < this.maxConcurrent && this.queue.length > 0) {
                const video = this.queue.shift();
                this.startDownload(video);
            }
        }

        // 开始下载任务
        startDownload(video) {
            this.currentDownloads++;
            this.downloading.add(video.url);

            // 使用 XMLHttpRequest 下载视频
            const xhr = new XMLHttpRequest();
            xhr.open("GET", video.url, true);
            xhr.responseType = "blob";

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const blob = xhr.response;
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.style.display = "none";
                    a.href = downloadUrl;

                    // 检查URL中的文件扩展名
                    let extension = video.isImage ? ".jpg" : ".mp4";
                    const urlPath = video.url.split('?')[0]; // 移除查询参数
                    const urlExtMatch = urlPath.match(/\.([a-zA-Z0-9]+)$/);
                    if (urlExtMatch && urlExtMatch[1]) {
                        extension = "." + urlExtMatch[1];
                    }

                    a.download = video.title + extension;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(downloadUrl);
                    showToast(`${video.title} 下载完成`);
                } else {
                    showToast(`${video.title} 下载失败`);
                    console.error("Download error:", xhr.statusText);
                }
                this.completeDownload(video);
            };

            xhr.onerror = () => {
                showToast(`${video.title} 下载失败`);
                console.error("Download error:", xhr.statusText);
                this.completeDownload(video);
            };

            xhr.send();
            showToast(`开始下载: ${video.title}`);
        }

        // 完成下载任务
        completeDownload(video) {
            this.currentDownloads--;
            this.downloading.delete(video.url);

            // 只有非图片组中的单独图片才需要从列表中移除
            // 图片组中的单独图片不需要从videoList中移除，因为它们不在列表中
            if (!video.isImage) {
                videoList = videoList.filter(v => v.url !== video.url);
                const panel = document.getElementById("controlPanel");
                if (panel) {
                    const videoElement = Array.from(panel.children).find(
                        el => el.querySelector('a')?.href === video.url
                    );
                    if (videoElement) {
                        panel.removeChild(videoElement);
                    }
                }
                updateToggleButtonText();
            }

            this.processQueue();
        }
    }

    // 创建下载队列实例
    const downloadQueue = new DownloadQueue(5);

    // 保存原始的 XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;

    // 创建一个新的 XMLHttpRequest
    function newXHR() {
        const xhr = new originalXHR();

        // 重写 open 方法
        const originalOpen = xhr.open;
        xhr.open = function (method, url, async, user, password) {
            this.addEventListener("readystatechange", function () {
                if (
                    this.readyState === 4 &&
                    this.status === 200 &&
                    (this.responseURL.includes("/aweme/v1/web/aweme/post/") || this.responseURL.includes('/aweme/v2/web/feed/'))
                ) {
                    let response = JSON.parse(this.responseText);
                    parseAndDownload(response);
                }
            }, false);
            originalOpen.call(this, method, url, async, user, password);
        };

        return xhr;
    }

    insertControlPanel();

    // 替换全局的 XMLHttpRequest
    window.XMLHttpRequest = newXHR;

    // 解析响应并显示视频信息
    function parseAndDownload(response) {
        if (response && response.aweme_list && response.aweme_list.length > 0) {
            response.aweme_list.forEach(aweme => {
                let title = aweme.preview_title || aweme?.desc;
                const prefix = aweme.mix_info?.statis?.current?.episode ? `第${aweme.mix_info?.statis?.current?.episode}集：` : ''
                title = (prefix + title);
                try {
                    if (aweme.aweme_type === 0 && aweme.media_type === 4) {
                        let videoUrl = aweme.video.play_addr.url_list[0];
                        if (videoUrl) {
                            insertVideoInfo(title, videoUrl);
                        }
                    }
                    if (aweme.aweme_type === 68 && aweme.media_type === 2) {

                        const images = aweme.images.map(image => {
                            return {
                                url: image.url_list[0],
                                width: image.width,
                                height: image.height
                            };
                        });

                        insertImageInfo(title, images)
                    }
                } catch (e) {
                    console.log(aweme, 'error', e);
                }
            });
        }
    }

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // 节流函数
    function throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 添加下载按钮到指定元素
    const debouncedAddDownloadButton = debounce(addDownloadButton, 200);
    const throttledAddDownloadButton = throttle(debouncedAddDownloadButton, 500);

    function addDownloadButton() {
        const targetElement = document.querySelector('[data-e2e="feed-active-video"]');
        if (!targetElement) return;
        const rightGrid = targetElement.querySelector('.xg-right-grid');
        if (!rightGrid) return;
        // 如果有下载按钮则不再添加
        if (rightGrid.querySelector(".download-button") || rightGrid.querySelector('.xgplayer-playback-setting') === null) {
            return;
        }
        if (rightGrid) {
            const downloadButton = document.createElement("button");
            downloadButton.innerHTML = `下载视频`;
            downloadButton.style.color = "white";
            downloadButton.style.border = "none";
            downloadButton.style.backgroundColor = 'transparent';
            downloadButton.style.borderRadius = "5px";
            downloadButton.style.padding = "10px";
            downloadButton.style.cursor = "pointer";
            downloadButton.className = "download-button";
            downloadButton.addEventListener("click", () => {
                const videoContainer = targetElement.querySelector(".xg-video-container");
                if (videoContainer) {
                    const videoSource = videoContainer.querySelector("video source");
                    const title = targetElement.querySelector('[data-e2e="video-desc"] span').textContent.replace(/\s/g, '');
                    if (videoSource && videoSource.src) {
                        const videoUrl = videoSource.src;
                        processDownload({title, url: videoUrl});
                    } else {
                        let isDownload = false;
                        // 去videoList根据title去查找链接
                        videoList.forEach(video => {
                            const prefix = video.title.split('_')[0] + '_';
                            const findTitle = video.title.replace(prefix, '')
                            console.log(findTitle, title, 'findTitle')
                            if (findTitle === title) {
                                isDownload = true;
                                processDownload(video);
                            }
                        });
                        if (!isDownload)
                            showToast("未找到视频链接");
                    }
                } else {
                    console.error("No video container found.");
                }
            });

            // 向前添加
            rightGrid.insertBefore(downloadButton, rightGrid.firstChild);
        } else {
            console.error("Target element not found.");
        }
    }

    // 使用 MutationObserver 来监控 DOM 变化，并调用添加按钮函数
    const observer = new MutationObserver(() => {
        throttledAddDownloadButton();
    });

    observer.observe(document.body, {childList: true, subtree: true});

    // 更新展开按钮文本
    function updateToggleButtonText() {
        const toggleButton = document.querySelector("#dy_video_download_toggle_btn");
        if (toggleButton) {
            const panel = document.getElementById("controlPanel");
            const isHidden = panel.style.display === "none";
            toggleButton.innerHTML = `${isHidden ? "展开" : "收起"} (${videoList.length})`;
        }
    }

    // 复制用户信息函数
    function copyUserInfo() {
        try {
            // 获取用户名（h1标签）
            const userName = document.querySelector('h1')?.innerText?.trim() || '';

            // 获取抖音号
            // 使用属性选择器查找包含"抖音号："文本的span
            const spans = Array.from(document.getElementsByTagName('span'));
            const douyinIdSpan = spans.find(span => span.textContent?.includes('抖音号：'));
            const douyinId = douyinIdSpan ? douyinIdSpan.textContent.replace('抖音号：', '').trim() : '';

            // 组合信息
            const info = `${userName} ${douyinId}`;

            // 复制到剪贴板
            navigator.clipboard.writeText(info).then(() => {
                showToast("用户信息已复制到剪贴板");
            }).catch(err => {
                console.error('复制失败:', err);
                showToast("复制失败，请手动复制");

                // 创建临时输入框作为后备方案
                const textarea = document.createElement('textarea');
                textarea.value = info;
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    showToast("用户信息已复制到剪贴板");
                } catch (e) {
                    showToast("复制失败，请手动复制");
                }
                document.body.removeChild(textarea);
            });
        } catch (error) {
            console.error('获取信息失败:', error);
            showToast("获取用户信息失败");
        }
    }

})();
