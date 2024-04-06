// ==UserScript==
// @name         网易云账号管理器
// @namespace    http://tampermonkey.net/
// @version      2024-04-06
// @description  记录ck,保存ck
// @author       23233
// @match        https://*music.163.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=163.com
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_cookie
// ==/UserScript==

(function () {
    'use strict';

    let globalUtilities = [];
    const DEFAULT_REMOTE_ADDRESS = 'http://127.0.0.1:6562';
    const DEFAULT_DEVICE_ID = 'dd';

    const DEFAULT_REMOTE_KEY = "__remote-address"
    const DEFAULT_DEVICE_KEY = "__device-id"

    // 获取存储值或使用默认值
    const storedRemoteAddress = localStorage.getItem(DEFAULT_REMOTE_KEY) || DEFAULT_REMOTE_ADDRESS;
    const storedDeviceId = localStorage.getItem(DEFAULT_DEVICE_KEY) || DEFAULT_DEVICE_ID;


    const Toast = (message, duration) => {
        // Create the toast element
        const toast = document.createElement("div");
        toast.textContent = message;
        toast.style.position = "fixed";
        toast.style.bottom = "20px";
        toast.style.left = "50%";
        toast.style.transform = "translateX(-50%)";
        toast.style.backgroundColor = "black";
        toast.style.color = "white";
        toast.style.padding = "10px";
        toast.style.borderRadius = "5px";
        toast.style.zIndex = "9999";
        toast.style.textAlign = "center";
        document.body.appendChild(toast);

        // Remove the toast after the specified duration
        setTimeout(function () {
            toast.parentNode.removeChild(toast);
        }, duration);

        // Remove the toast when it's clicked
        toast.addEventListener("click", function () {
            toast.parentNode.removeChild(toast);
        });
    };

    function createUtilityItem(utility) {
        const container = document.createElement('div');
        container.classList.add('utility-item');
        container.innerHTML = `
            <span class="utility-name">${utility.name}</span>
            <span>${utility?.is_singer ? "歌手":"非歌手"}</span>
            <button class="edit">修改</button>
            <button class="delete">删除</button>
            <button class="copy">复制</button>
            <button class="set">设置</button>
        `;

        container.querySelector('.edit').onclick = () => editUtility(utility);
        container.querySelector('.delete').onclick = () => deleteUtility(utility);
        container.querySelector('.copy').onclick = () => onCopy(utility.ck);
        container.querySelector('.set').onclick = () => onSet(utility.ck);

        return container;
    }

    function onSet(ck) {
        clearCookies(function () {
            setCookies(ck)

        })
    }

    function setCookies(data) {
        if (!data.length) {
            Toast("请输入cookies后重试", 3000)
            return false
        }
        var cookies = data.split(';');
        cookies.forEach(function (cookie) {
            var parts = cookie.split('=');
            GM_cookie.set({
                url: window.location.href,
                domain: ".music.163.com",
                name: parts[0]?.trim(),
                value: parts[1]?.trim()
            }, function (error) {
                if (error) {
                    console.warn(error, "GM_cookie不受支持 回退到document.cookie 无法获取到httpOnly的key")
                    Toast("当前不支持GM_cookie 回退到document.cookie 无法获取到httpOnly的key", 3000)
                    document.cookie = parts[0] + '=' + parts[1];
                }
            });
        });
        Toast("设置cookie成功", 3000)
        return true
    }

    // Function to clear cookies
    function clearCookies(cb) {
        GM_cookie.list({}, function (cookies, error) {
            if (!error) {
                cookies.forEach(function (cookie) {
                    GM_cookie.delete({
                        url: window.location.href,
                        name: cookie.name
                    });
                });
                Toast("清除cookies成功", 3000)
                cb && cb()
            } else {
                console.warn("GM_cookie不受支持 无法清除httpOnly的key")
                Toast("当前不支持GM_cookie 无法清除httpOnly的key", 3000)
            }
        });
    }

    function getCookies(callback) {
        GM_cookie.list({}, function (cookies, error) {
            if (!error) {
                var data = cookies.map(cookie => cookie.name + '=' + cookie.value).join('; ');
                callback(data);
            } else {

                console.warn("GM_cookie不受支持 回退到document.cookie 无法获取到httpOnly的key")
                Toast("当前不支持GM_cookie 回退到document.cookie 无法获取到httpOnly的key", 3000)
                callback(document.cookie);
            }
        });
    }

    function onCopy(text) {
        GM_setClipboard(text)
        Toast("复制成功", 1000)
    }

    function editUtility(utility) {
        const newName = prompt('修改名称', utility.name);
        const newCk = prompt('修改CK', utility.ck);
        const isSinger = confirm("是否是歌手账号")
        const remoteAddress = document.getElementById('remote-address').value;
        const deviceId = document.getElementById('device-id').value;
        const url = `${remoteAddress}/remote_cookies/${utility.uid}`; // 注意这里是如何将uid添加到URL中的

        if (newName && newCk && deviceId) {
            const putData = {
                cookie: newCk,
                remark: newName,
                devices: deviceId,
                is_singer:isSinger,
            };

            GM_xmlhttpRequest({
                method: "PUT",
                url: url,
                data: JSON.stringify(putData),
                headers: {
                    "Content-Type": "application/json"
                },
                onload: function (response) {
                    if (response.status >= 200 && response.status < 300) {
                        // 可在此处加入PUT请求成功后的逻辑，比如提示用户或者更新页面元素等
                        console.log('编辑成功：', response.responseText);
                        syncUtilities();
                    } else {
                        console.error('编辑失败:', response.statusText, response.responseText);
                        alert('编辑失败');
                    }
                },
                onerror: function (response) {
                    console.error('请求失败:', response.statusText, response.responseText);
                    alert('请求失败');
                }
            });
        }
    }

    function deleteUtility(utility) {
        if (confirm('是否确认删除？')) {
            const remoteAddress = document.getElementById('remote-address').value;
            const url = `${remoteAddress}/remote_cookies/${utility.uid}`; // 组装请求URL，将uid作为参数

            // 发起DELETE请求
            GM_xmlhttpRequest({
                method: "DELETE",
                url: url,
                onload: function (response) {
                    if (response.status >= 200 && response.status < 300) {
                        // 请求成功，可以执行后续的同步操作
                        console.log('删除成功：', response.responseText);
                        syncUtilities(); // 删除成功后执行同步操作，更新本地状态
                    } else {
                        console.error('删除失败:', response.statusText);
                        alert('删除失败');
                    }
                },
                onerror: function (response) {
                    console.error('请求失败:', response.statusText);
                    alert('请求失败');
                }
            });
        }

    }


    // 修改后的处理函数，用于添加并同步工具
    function addAndSyncUtility() {
        const name = prompt('请输入名称');
        const ck = prompt('请输入CK');
        const isSinger = confirm("是否是歌手账号")
        return addAndSync(name, ck,isSinger)
    }

    function addAndSync(name, ck,isSinger) {
        const remoteAddress = document.getElementById('remote-address').value;
        const deviceId = document.getElementById('device-id').value;

        if (name && ck && deviceId) {

            const postData = {
                cookie: ck,
                remark: name,
                devices: deviceId,
                is_singer:isSinger
            };

            GM_xmlhttpRequest({
                method: "POST",
                url: remoteAddress + '/remote_cookies',
                data: JSON.stringify(postData),
                headers: {
                    "Content-Type": "application/json"
                },
                onload: function (response) {
                    if (response.status >= 200 && response.status < 300) {
                        // Assuming the response is in JSON format
                        const data = JSON.parse(response.responseText);
                        // 同步成功后执行一次同步方法，即调用syncUtilities
                        syncUtilities();
                    } else {
                        console.error('新增失败:', response.statusText);
                        alert('新增失败');
                    }
                },
                onerror: function (response) {
                    console.error('请求失败:', response.statusText);
                    alert('请求失败');
                }
            });
        }
    }

    function getDefaultUserName() {
        try {
            let contentIframe = document.getElementById('g_iframe');
            let iframeDoc = contentIframe.contentDocument ? contentIframe.contentDocument : contentIframe.contentWindow.document;
            let targetElement = iframeDoc.querySelector('#j-name-wrap span.tit');
            if (targetElement) {
                return targetElement.innerText
            }
        } catch (e) {
            console.error("获取默认用户名失败", e)
        }

        return ""

    }

    function containsRequiredSubstrings(str) {
        return str.includes("MUSIC_U") && str.includes("__csrf");
    }

    function nowAddUtility() {
        getCookies(function (cookie) {
            if (containsRequiredSubstrings(cookie)) {
                const defaultName = getDefaultUserName()
                console.log("defaultName", defaultName)
                const name = prompt('请输入名称', defaultName);
                const ck = prompt('请输入CK', cookie);
                const isSinger = confirm("是否是歌手账号")
                return addAndSync(name, ck,isSinger)
            } else {
                alert("检测到cookie未登录 不能从当前新增")
            }
        })
    }


    function exitNowCookies() {
        clearCookies()
    }


    function render() {
        const utilities = globalUtilities;
        const panel = document.querySelector('#u_content_render');
        panel.innerHTML = ""

        // 下面的代码逻辑保持不变，用于加载并显示utility列表
        utilities.forEach(utility => {
            panel.appendChild(createUtilityItem(utility)); // 假设你有一个为每个实用程序创建DOM元素的函数
        });
    }

    // 同步按钮点击事件处理函数
    function syncUtilities() {
        const remoteAddress = document.getElementById('remote-address').value;
        const deviceId = document.getElementById('device-id').value;
        const url = `${remoteAddress}/remote_cookies?devices=${deviceId}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function (response) {
                if (response.status >= 200 && response.status < 300) {
                    const data = JSON.parse(response.responseText);
                    if (data && data.data) {
                        globalUtilities = data.data.map(item => {
                            const name = item?.remark || item?.nick_name || "";
                            return {name: name, ck: item.cookie, uid: item.uid,is_singer:!!item?.is_singer};
                        });
                        render();
                        // 重新渲染面板以显示新数据
                        return
                    }
                    globalUtilities = []
                    render();
                } else {
                    console.error('Sync failed:', response.statusText);
                    alert('同步失败');
                }
            },
            onerror: function (response) {
                console.error('请求失败:', response.statusText);
                alert('请求失败');
            },
        });


    }

    function createToggleButton() {
        const toggleButton = document.createElement('button');
        toggleButton.innerText = '账号';
        toggleButton.style.position = 'fixed';
        toggleButton.style.right = '5px';
        toggleButton.style.top = '10px';
        toggleButton.style.zIndex = '10001'; // 确保按钮在大多数元素之上
        toggleButton.style.backgroundColor = '#FFF'; // 设置一个基本的背景色
        toggleButton.style.color = '#000'; // 设置文字颜色以确保可读性
        toggleButton.style.border = '1px solid #CCC'; // 可选：添加边框以增加可见性
        toggleButton.style.padding = '5px 10px'; // 添加一些内边距以改善外观
        toggleButton.style.borderRadius = '5px'; // 可选：为按钮添加圆角
        toggleButton.style.cursor = 'pointer'; // 更改鼠标悬停时的光标形状

        toggleButton.onclick = () => {
            const panel = document.querySelector('.utility-panel');
            panel.classList.toggle('hidden');
        };
        document.body.appendChild(toggleButton);
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.classList.add('utility-panel', 'hidden'); // 初始隐藏面板
        document.body.appendChild(panel);

        // 设置面板的内部HTML
        panel.innerHTML = `
        <div id="u_fix_bar"></div>
        <div id="u_content_render"></div>
    `

        // 创建fixBar并设置其内部HTML
        const fixBar = document.createElement("div");
        fixBar.innerHTML = `
    <div>
        <button id="add-utility-btn">新增</button>
        <button id="now-add-btn">从当前新增</button>
        <button id="now-exit-btn">退出当前</button>
        <button id="sync-button">同步</button>
    </div>
    <div>
        <input id="remote-address" placeholder="远程地址" value="${storedRemoteAddress}" class="u_input">
        <input id="device-id" placeholder="设备ID" value="${storedDeviceId}" class="u_input">
    </div>
    `
        document.querySelector('#u_fix_bar').appendChild(fixBar);

        // 使用事件委托处理按钮的点击事件
        panel.addEventListener('click', function(event) {
            const target = event.target;
            if (target.id === 'add-utility-btn') {
                addAndSyncUtility();
            } else if (target.id === 'now-add-btn') {
                nowAddUtility();
            } else if (target.id === 'now-exit-btn') {
                exitNowCookies();
            } else if (target.id === 'sync-button') {
                syncUtilities();
            }
        });

        // 给remote-address和device-id输入框增加监听器，以便在更改时更新localStorage
        document.getElementById('remote-address').addEventListener('change', (e) => {
            localStorage.setItem(DEFAULT_REMOTE_KEY, e.target.value);
        });

        document.getElementById('device-id').addEventListener('change', (e) => {
            localStorage.setItem(DEFAULT_DEVICE_KEY, e.target.value);
        });

        syncUtilities()

    }


    // 在样式中增加控制隐藏的样式
    function injectStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            .utility-panel {
                position: fixed;
                top: 50px; /* Adjust if needed, to avoid overlapping the toggle button */
                right: 20px;
                background-color: white;
                padding: 10px;
                box-shadow: 0 0 5px rgb(0,0,0,0.2);
                border-radius: 5px;
                z-index: 10000;
                display: none; /* Initially hidden */
            }
            .utility-panel.hidden {
                display: none;
            }
            .utility-panel:not(.hidden) {
                display: block;
            }
            .utility-panel button {
                margin-right:5px;
            }
            .utility-item {
                margin-top:5px;
                margin-bottom:5px;
            }
            .utility-item span {
                min-width:42px;
                display:inline-block;
                font-size:14px;
            }
            .utility-item .utility-name {
                width:100px;
            }
            .u_input {
                padding: 3px;
                font-size: 12px;
                margin-top: 5px;
                display: inline-block;
                width: 80px;
            }
            /* Add more styles as needed */
        `;
        document.head.appendChild(style);
    }

    // 在函数最后添加以下代码片段


    // Main
    function main() {
        createPanel();
        createToggleButton(); // 创建切换按钮
        injectStyles();

    }

    // Run script after document is loaded
    if (document.readyState === "complete" || (document.readyState !== "loading" && !document.documentElement.doScroll)) {
        main();
    } else {
        document.addEventListener("DOMContentLoaded", main);
    }


})();