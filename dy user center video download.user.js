// ==UserScript==
// @name         抖音主页视频下载
// @namespace    http://tampermonkey.net/
// @version      1.9
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
        toggleButton.innerHTML = "展开";
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
            toggleButton.innerHTML = isHidden ? "收起" : "展开";
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
        buttonContainer.style.padding = "5px";
        buttonContainer.style.borderTop = "1px solid #ccc";

        const downloadAllButton = document.createElement("button");
        downloadAllButton.innerHTML = "下载全部";
        downloadAllButton.style.flex = "1";
        downloadAllButton.style.marginRight = "5px";
        downloadAllButton.style.backgroundColor = "#28a745";
        downloadAllButton.style.color = "white";
        downloadAllButton.style.border = "none";
        downloadAllButton.style.borderRadius = "5px";
        downloadAllButton.style.padding = "10px";
        downloadAllButton.style.cursor = "pointer";
        downloadAllButton.addEventListener("click", downloadAll);

        const downloadSelectedButton = document.createElement("button");
        downloadSelectedButton.innerHTML = "下载选中";
        downloadSelectedButton.style.flex = "1";
        downloadSelectedButton.style.marginLeft = "5px";
        downloadSelectedButton.style.backgroundColor = "#ffc107";
        downloadSelectedButton.style.color = "white";
        downloadSelectedButton.style.border = "none";
        downloadSelectedButton.style.borderRadius = "5px";
        downloadSelectedButton.style.padding = "10px";
        downloadSelectedButton.style.cursor = "pointer";
        downloadSelectedButton.addEventListener("click", downloadSelected);


        // 清空全部
        const clearAllButton = document.createElement("button");
        clearAllButton.innerHTML = "清空全部";
        clearAllButton.style.flex = "1";
        clearAllButton.style.marginLeft = "5px";
        clearAllButton.style.backgroundColor = "#dc3545";
        clearAllButton.style.color = "white";
        clearAllButton.style.border = "none";
        clearAllButton.style.borderRadius = "5px";
        clearAllButton.style.padding = "10px";
        clearAllButton.style.cursor = "pointer";
        clearAllButton.addEventListener("click", () => {
            videoList = [];
            panel.innerHTML = "";
            count = 0;
        });

        // 清空选中
        const clearSelectedButton = document.createElement("button");
        clearSelectedButton.innerHTML = "清空选中";
        clearSelectedButton.style.flex = "1";
        clearSelectedButton.style.marginLeft = "5px";
        clearSelectedButton.style.backgroundColor = "#f15050";
        clearSelectedButton.style.color = "white";
        clearSelectedButton.style.border = "none";
        clearSelectedButton.style.borderRadius = "5px";
        clearSelectedButton.style.padding = "10px";
        clearSelectedButton.style.cursor = "pointer";
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
    }

    // 下载所有视频
    function downloadAll() {
        videoList.forEach(video => downloadVideo(video.title, video.url));
    }

    // 下载选中的视频
    function downloadSelected() {
        videoList.forEach(video => {
            if (video.checkbox.checked) {
                downloadVideo(video.title, video.url);
            }
        });
    }

    // 使用 XMLHttpRequest 下载视频
    function downloadVideo(title, url) {
        // 下载一个就将数据删除
        videoList = videoList.filter(video => video.url !== url);
        // 确保 URL 使用 HTTPS
        if (!url.startsWith('https://')) {
            url = url.replace('http://', 'https://');
        }
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.responseType = "blob";
        xhr.onload = function () {
            if (xhr.status === 200) {
                const blob = xhr.response;
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.style.display = "none";
                a.href = downloadUrl;
                a.download = title + ".mp4";
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(downloadUrl);
                console.log("Download completed");
                showToast("下载完成");
            } else {
                console.error("Download error:", xhr.statusText);
            }
        };
        xhr.onerror = function () {
            console.error("Download error:", xhr.statusText);
        };
        xhr.send();
    }

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
                try {
                    if (aweme.aweme_type !== 101) {
                        let videoUrl = aweme.video.play_addr.url_list[0];
                        let title = aweme.preview_title || aweme.desc;
                        const prefix = aweme.mix_info?.statis?.current?.episode ? `第${aweme.mix_info?.statis?.current?.episode}集：` : ''
                        title = (prefix + title);
                        if (videoUrl) {
                            insertVideoInfo(title, videoUrl);
                        }
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
                        downloadVideo(title, videoUrl);
                    } else {
                        let isDownload = false;
                        // 去videoList根据title去查找链接
                        videoList.forEach(video => {
                            const prefix = video.title.split('_')[0] + '_';
                            const findTitle = video.title.replace(prefix, '')
                            console.log(findTitle, title, 'findTitle')
                            if (findTitle === title) {
                                isDownload = true;
                                downloadVideo(video.title, video.url);
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

})();
