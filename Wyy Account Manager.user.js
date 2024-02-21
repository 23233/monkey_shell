// ==UserScript==
// @name         网易云账号管理器
// @namespace    http://tampermonkey.net/
// @version      2024-02-21
// @description  记录ck,保存ck
// @author       23233
// @match        https://*music.163.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=163.com
// @grant        GM_setClipboard
// @grant        GM_cookie
// ==/UserScript==

(function() {
    'use strict';
    const storageKey = 'music163_utilities';

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


    function loadUtilities() {
        return JSON.parse(localStorage.getItem(storageKey) || '[]');
    }

    function saveUtilities(utilities) {
        localStorage.setItem(storageKey, JSON.stringify(utilities));
    }

    function createUtilityItem(utility) {
        const container = document.createElement('div');
        container.classList.add('utility-item');
        container.innerHTML = `
            <span>${utility.name}</span>
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

    function onSet(ck){
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
                name: parts[0].trim(),
                value: parts[1].trim()
            }, function (error) {
                if (error) {
                    console.warn(error, "GM_cookie不受支持 回退到document.cookie 无法获取到httpOnly的key")
                    Toast("当前不支持GM_cookie 回退到document.cookie 无法获取到httpOnly的key", 3000)
                    document.cookie = parts[0] + '=' + parts[1];
                }
            });
        });
        Toast("设置cookie成功",3000)
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



    function onCopy(text){
        GM_setClipboard(text)
        Toast("复制成功",1000)
    }

    function editUtility(utility) {
        const newName = prompt('修改名称', utility.name);
        const newCk = prompt('修改CK', utility.ck);
        if (newName && newCk) {
            const utilities = loadUtilities();
            const index = utilities.findIndex(u => u.name === utility.name && u.ck === utility.ck);
            utilities[index] = { name: newName, ck: newCk };
            saveUtilities(utilities);
            render();
        }
    }

    function deleteUtility(utility) {
        if (confirm('是否确认删除？')) {
            let utilities = loadUtilities();
            utilities = utilities.filter(u => u.name !== utility.name || u.ck !== utility.ck);
            saveUtilities(utilities);
            render();
        }
    }

    function addUtility() {
        const name = prompt('请输入名称');
        const ck = prompt('请输入CK');
        if (name && ck) {
            const utilities = loadUtilities();
            utilities.push({ name, ck });
            saveUtilities(utilities);
            render();
        }
    }

    function render() {
        const utilities = loadUtilities();
        const panel = document.querySelector('.utility-panel');

        // 重置面板并重新添加按钮，确保导入、导出按钮也保留
        panel.innerHTML = `
        <button id="add-utility-btn">新增</button>
        <button id="import-utility-btn">导入</button>
        <button id="export-utility-btn">导出</button>
    `;

        // 绑定按钮的点击事件
        document.querySelector('#add-utility-btn').onclick = addUtility; // 假设你有一个添加实用程序的函数
        document.querySelector('#import-utility-btn').onclick = importUtilities;
        document.querySelector('#export-utility-btn').onclick = exportUtilities;

        // 下面的代码逻辑保持不变，用于加载并显示utility列表
        utilities.forEach(utility => {
            panel.appendChild(createUtilityItem(utility)); // 假设你有一个为每个实用程序创建DOM元素的函数
        });
    }


    function createToggleButton() {
        const toggleButton = document.createElement('button');
        toggleButton.innerText = '账号管理';
        toggleButton.style.position = 'fixed';
        toggleButton.style.right = '20px';
        toggleButton.style.top = '20px';
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

        // 初始创建时加入添加按钮
        const addButton = document.createElement('button');
        addButton.id = 'add-utility-btn'; // 给添加按钮一个ID
        addButton.innerText = '新增';
        addButton.onclick = addUtility;
        panel.appendChild(addButton);

        render();
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
                width:100px;
                display:inline-block;
                font-size:14px;

            }
            /* Add more styles as needed */
        `;
        document.head.appendChild(style);
    }
    // 在函数最后添加以下代码片段
    function exportUtilities() {
        const utilities = loadUtilities();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilities));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "music163_utilities.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function importUtilities() {
        const inputFile = document.createElement('input');
        inputFile.type = 'file';
        inputFile.accept = '.json';

        inputFile.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const utilities = JSON.parse(event.target.result);
                        saveUtilities(utilities);
                        render();
                        alert("导入成功！");
                    } catch (e) {
                        alert("导入失败，文件格式错误。");
                    }
                };
                reader.readAsText(file);
            }
        };
        inputFile.click();
    }

    // Main
    function main() {
        createPanel();
        createToggleButton(); // 创建切换按钮
        injectStyles();

    }

    // Run script after document is loaded
    if(document.readyState === "complete" || (document.readyState !== "loading" && !document.documentElement.doScroll)) {
        main();
    } else {
        document.addEventListener("DOMContentLoaded", main);
    }


})();