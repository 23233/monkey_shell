// ==UserScript==
// @name         本地项目文件内容读取工具 (v1.7-修改版)
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  通过选择本地文件夹，构建可折叠/展开的文件树，支持过滤，支持多选，一键复制"路径+内容"到剪贴板。所有UI样式和ID均已添加前缀以防止冲突。面板位置可保存，默认折叠。
// @author       Gemini (Modified by Assistant)
// @match        *://aistudio.google.com/*
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置区域 ---
    const foldersToIgnore = ['.git', '.idea', 'node_modules', '__pycache__',"logs"]; // 在这里添加更多你想忽略的文件夹名称
    const prefix = 'upc-'; // 为所有CSS类名和ID添加不冲突的前缀
    const positionStorageKey = `${prefix}panel-position`; // 【新增】用于localStorage的键名

    // --- IndexedDB 封装 ---
    const dbName = 'project-copier-db';
    const storeName = 'directory-handles';
    let db;

    async function openDb() {
        if (db) return db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(storeName);
            request.onsuccess = () => { db = request.result; resolve(db); };
            request.onerror = (event) => reject('IndexedDB error: ' + event.target.errorCode);
        });
    }

    async function setHandle(key, value) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject('Transaction error: ' + event.target.errorCode);
        });
    }

    async function getHandle(key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Transaction error: ' + event.target.errorCode);
        });
    }

    // --- 全局变量 ---
    let rootDirectoryHandle = null;

    // --- UI 构建 (使用createElement以兼容CSP, 并添加前缀) ---
    function buildUI() {
        const panel = document.createElement('div');
        panel.id = `${prefix}panel`;

        const header = document.createElement('div');
        header.id = `${prefix}header`;
        const headerTitle = document.createElement('span');
        headerTitle.textContent = '项目文件读取工具';
        const toggleBtn = document.createElement('button');
        toggleBtn.id = `${prefix}toggle-btn`;
        // 【修改】默认显示为展开按钮"+"
        toggleBtn.textContent = '+';
        header.appendChild(headerTitle);
        header.appendChild(toggleBtn);

        const body = document.createElement('div');
        body.id = `${prefix}body`;
        // 【修改】默认不展开，添加隐藏class
        body.classList.add(`${prefix}hidden`);

        const controls = document.createElement('div');
        controls.id = `${prefix}controls`;
        const selectFolderBtn = document.createElement('button');
        selectFolderBtn.id = `${prefix}select-folder-btn`;
        selectFolderBtn.textContent = '1. 选择项目文件夹';
        controls.appendChild(selectFolderBtn);

        const folderDisplayWrapper = document.createElement('div');
        folderDisplayWrapper.id = `${prefix}folder-display-wrapper`;
        const currentProjectLabel = document.createElement('span');
        currentProjectLabel.textContent = '当前项目:';
        const folderNameSpan = document.createElement('span');
        folderNameSpan.id = `${prefix}folder-name`;
        folderNameSpan.title = '点击刷新文件树';
        folderNameSpan.textContent = '无';
        folderDisplayWrapper.appendChild(currentProjectLabel);
        folderDisplayWrapper.appendChild(folderNameSpan);
        controls.appendChild(folderDisplayWrapper);

        const fileTreeContainer = document.createElement('div');
        fileTreeContainer.id = `${prefix}file-tree-container`;
        fileTreeContainer.setAttribute('placeholder', '请先选择一个文件夹...');

        const copyContentBtn = document.createElement('button');
        copyContentBtn.id = `${prefix}copy-content-btn`;
        copyContentBtn.textContent = '2. 复制选中内容到剪贴板';
        copyContentBtn.disabled = true;

        const statusDiv = document.createElement('div');
        statusDiv.id = `${prefix}status`;

        body.appendChild(controls);
        body.appendChild(fileTreeContainer);
        body.appendChild(copyContentBtn);
        body.appendChild(statusDiv);

        panel.appendChild(header);
        panel.appendChild(body);
        document.body.appendChild(panel);

        // --- 添加样式 (修正：先构建CSS字符串，再传递给GM_addStyle) ---
        const css = `
            /* 【修改】移除固定的bottom和right，以便可以通过top/left定位 */
            #${prefix}panel { position: fixed; width: 400px; max-width: 90vw; max-height: 80vh; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; color: #333; }
            #${prefix}header { padding: 8px 12px; background-color: #e0e0e0; cursor: move; border-bottom: 1px solid #ccc; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
            #${prefix}body { padding: 12px; display: flex; flex-direction: column; overflow: hidden; }
            #${prefix}body.${prefix}hidden { display: none; }
            #${prefix}controls, #${prefix}folder-display-wrapper { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
            #${prefix}folder-display-wrapper { margin-top: 8px; }
            #${prefix}folder-name { font-weight: bold; color: #0056b3; background-color: #e9ecef; padding: 4px 8px; border-radius: 4px; cursor: pointer; }
            #${prefix}panel button { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background-color: #fff; cursor: pointer; transition: background-color 0.2s; }
            #${prefix}panel button:hover:not(:disabled) { background-color: #e6e6e6; }
            #${prefix}panel button:disabled { cursor: not-allowed; background-color: #f8f8f8; color: #aaa; }
            #${prefix}file-tree-container { flex-grow: 1; overflow-y: auto; border: 1px solid #ccc; padding: 8px; background-color: #fff; min-height: 150px; margin-bottom: 12px; }
            #${prefix}file-tree-container:empty::before { content: attr(placeholder); color: #999; }
            #${prefix}status { font-size: 12px; color: green; text-align: center; min-height: 1em; }
            /* 文件树样式 */
            .${prefix}tree-ul { list-style-type: none; padding-left: 20px; }
            .${prefix}tree-li { margin: 4px 0; }
            .${prefix}tree-li label { display: flex; align-items: center; }
            .${prefix}tree-li input[type="checkbox"] { margin-right: 8px; }
            .${prefix}folder-label { cursor: pointer; }
            .${prefix}folder-label::before { content: '📁'; margin-right: 4px; }
            .${prefix}file-label::before { content: '📄'; margin-right: 4px; }
            /* 折叠/展开样式 */
            .${prefix}folder-label.${prefix}collapsible::before { content: '+ 📁'; font-family: monospace; }
            .${prefix}folder-label.${prefix}collapsible.${prefix}expanded::before { content: '- 📁'; font-family: monospace; }
            .${prefix}tree-ul.${prefix}nested { display: none; }
            .${prefix}tree-ul.${prefix}nested.${prefix}active { display: block; }
        `;
        GM_addStyle(css);
    }

    // --- 功能实现 ---
    function updateUI() {
        const folderNameEl = document.getElementById(`${prefix}folder-name`);
        const copyBtn = document.getElementById(`${prefix}copy-content-btn`);
        if (rootDirectoryHandle) {
            folderNameEl.textContent = rootDirectoryHandle.name;
            copyBtn.disabled = false;
        } else {
            folderNameEl.textContent = '无';
            copyBtn.disabled = true;
        }
    }

    function showStatus(message, duration = 3000) {
        const statusEl = document.getElementById(`${prefix}status`);
        statusEl.textContent = message;
        setTimeout(() => {
            if (statusEl.textContent === message) {
                statusEl.textContent = '';
            }
        }, duration);
    }

    async function createFileTree(directoryHandle, currentPath = '') {
        const ul = document.createElement('ul');
        ul.className = `${prefix}tree-ul`;
        try {
            const entries = [];
            for await (const entry of directoryHandle.values()) {
                entries.push(entry);
            }
            entries.sort((a, b) => {
                if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            for (const entry of entries) {
                if (entry.kind === 'directory' && foldersToIgnore.includes(entry.name)) {
                    continue;
                }

                const li = document.createElement('li');
                li.className = `${prefix}tree-li`;
                li.handle = entry;
                li.dataset.path = `${currentPath}${entry.name}`;
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                label.appendChild(checkbox);
                const nameSpan = document.createElement('span');
                nameSpan.textContent = entry.name;
                label.appendChild(nameSpan);
                li.appendChild(label);

                if (entry.kind === 'directory') {
                    li.classList.add(`${prefix}folder-entry`);
                    label.classList.add(`${prefix}folder-label`, `${prefix}collapsible`);
                    li.dataset.path += '/';
                    const subUl = await createFileTree(entry, li.dataset.path);
                    if (subUl.hasChildNodes()) {
                        subUl.classList.add(`${prefix}nested`);
                        li.appendChild(subUl);
                    } else {
                        label.classList.remove(`${prefix}collapsible`);
                    }
                } else {
                    li.classList.add(`${prefix}file-entry`);
                    label.classList.add(`${prefix}file-label`);
                }
                ul.appendChild(li);
            }
        } catch (error) {
            console.error("无法访问文件系统:", error);
            showStatus("错误: 无法读取文件夹内容。", 5000);
        }
        return ul;
    }

    async function renderFileTree() {
        const container = document.getElementById(`${prefix}file-tree-container`);
        if (!rootDirectoryHandle) {
            container.textContent = '';
            showStatus("请先选择一个文件夹。");
            return;
        }
        container.textContent = '正在加载文件树...';
        if (await rootDirectoryHandle.queryPermission({ mode: 'read' }) !== 'granted') {
            if (await rootDirectoryHandle.requestPermission({ mode: 'read' }) !== 'granted') {
                showStatus("需要文件夹读取权限才能继续。");
                rootDirectoryHandle = null;
                updateUI();
                return;
            }
        }
        const treeUl = await createFileTree(rootDirectoryHandle, '');
        container.textContent = '';
        container.appendChild(treeUl);
    }

    function handleCheckboxChange(e) {
        if (e.target.type !== 'checkbox') return;
        const li = e.target.closest(`.${prefix}tree-li`);
        if (!li || !li.classList.contains(`${prefix}folder-entry`)) return;
        const isChecked = e.target.checked;
        const subCheckboxes = li.querySelectorAll('input[type="checkbox"]');
        subCheckboxes.forEach(cb => cb.checked = isChecked);
    }

    async function selectFolder() {
        try {
            const handle = await window.showDirectoryPicker();
            if (handle) {
                rootDirectoryHandle = handle;
                await setHandle('last-used-dir', handle);
                updateUI();
                await renderFileTree();
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("选择文件夹时发生错误:", err);
                showStatus("选择文件夹失败！");
            }
        }
    }

    async function copyContent() {
        const copyBtn = document.getElementById(`${prefix}copy-content-btn`);
        copyBtn.disabled = true;
        copyBtn.textContent = '正在读取...';
        try {
            const selectedFiles = document.querySelectorAll(`#${prefix}file-tree-container .${prefix}file-entry input[type="checkbox"]:checked`);
            if (selectedFiles.length === 0) {
                showStatus("没有选择任何文件！");
                return;
            }
            let finalContent = '';
            const totalFiles = selectedFiles.length;
            let processedFiles = 0;
            for (const checkbox of selectedFiles) {
                const li = checkbox.closest(`.${prefix}file-entry`);
                if (li && li.handle) {
                    const path = li.dataset.path;
                    const fileHandle = li.handle;
                    if (await fileHandle.queryPermission({ mode: 'read' }) !== 'granted') {
                        if (await fileHandle.requestPermission({ mode: 'read' }) !== 'granted') {
                            showStatus(`跳过文件（无权限）: ${path}`);
                            continue;
                        }
                    }
                    const file = await fileHandle.getFile();
                    const content = await file.text();
                    finalContent += `// File: ${path}\n`;
                    finalContent += content;
                    finalContent += `\n\n`;
                }
                processedFiles++;
                copyBtn.textContent = `读取中 (${processedFiles}/${totalFiles})...`;
            }
            await navigator.clipboard.writeText(finalContent);
            showStatus(`成功复制 ${processedFiles} 个文件的内容！`);
            copyBtn.textContent = '复制成功!';
            setTimeout(() => {
                copyBtn.textContent = '2. 复制选中内容到剪贴板';
            }, 2000);
        } catch (error) {
            console.error("复制内容时发生错误:", error);
            showStatus("复制失败！详情请查看控制台。");
            copyBtn.textContent = '2. 复制选中内容到剪贴板';
        } finally {
            copyBtn.disabled = false;
        }
    }

    async function loadCachedHandle() {
        try {
            const handle = await getHandle('last-used-dir');
            if (handle) {
                if (await handle.queryPermission({ mode: 'read' }) === 'granted') {
                    rootDirectoryHandle = handle;
                    updateUI();
                    showStatus("已恢复上次选择的项目。点击项目名称可刷新文件树。");
                } else {
                    showStatus("找到上次项目，但需重新授权。请点击项目名授权。");
                    rootDirectoryHandle = handle;
                    updateUI();
                }
            }
        } catch (error) {
            console.error("加载缓存的句柄失败:", error);
        }
    }

    function handleTreeClick(e) {
        const label = e.target.closest(`.${prefix}folder-label`);
        if (!label || e.target.type === 'checkbox') {
            return;
        }
        e.preventDefault();
        const li = label.closest(`.${prefix}folder-entry`);
        const nestedList = li.querySelector(`.${prefix}tree-ul.${prefix}nested`);
        if (nestedList) {
            label.classList.toggle(`${prefix}expanded`);
            nestedList.classList.toggle(`${prefix}active`);
        }
    }

    function addEventListeners() {
        document.getElementById(`${prefix}select-folder-btn`).addEventListener('click', selectFolder);
        document.getElementById(`${prefix}copy-content-btn`).addEventListener('click', copyContent);
        document.getElementById(`${prefix}folder-name`).addEventListener('click', renderFileTree);
        const fileTreeContainer = document.getElementById(`${prefix}file-tree-container`);
        fileTreeContainer.addEventListener('change', handleCheckboxChange);
        fileTreeContainer.addEventListener('click', handleTreeClick);

        const header = document.getElementById(`${prefix}header`);
        const panel = document.getElementById(`${prefix}panel`);
        let isDragging = false, offset = { x: 0, y: 0 };
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offset.x = e.clientX - panel.offsetLeft;
            offset.y = e.clientY - panel.offsetTop;
            panel.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            // 【修改】在拖动时，动态设置top和left，并清除bottom和right
            panel.style.left = `${e.clientX - offset.x}px`;
            panel.style.top = `${e.clientY - offset.y}px`;
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => {
            if (!isDragging) return; // 【新增】判断，防止非拖拽的mouseup也触发保存
            isDragging = false;
            panel.style.userSelect = 'auto';
            // 【新增】拖动结束后，保存位置到localStorage
            try {
                const pos = { top: panel.style.top, left: panel.style.left };
                localStorage.setItem(positionStorageKey, JSON.stringify(pos));
            } catch (error) {
                console.error('保存面板位置失败:', error);
            }
        });
        document.getElementById(`${prefix}toggle-btn`).addEventListener('click', () => {
            const body = document.getElementById(`${prefix}body`);
            body.classList.toggle(`${prefix}hidden`);
            document.getElementById(`${prefix}toggle-btn`).textContent = body.classList.contains(`${prefix}hidden`) ? '+' : '-';
        });
    }

    // 【新增】一个函数用于加载并应用保存的位置
    function loadPanelPosition() {
        const panel = document.getElementById(`${prefix}panel`);
        try {
            const savedPosition = localStorage.getItem(positionStorageKey);
            if (savedPosition) {
                const pos = JSON.parse(savedPosition);
                // 确保pos对象和其属性存在
                if (pos && pos.top && pos.left) {
                    panel.style.top = pos.top;
                    panel.style.left = pos.left;
                    panel.style.bottom = 'auto';
                    panel.style.right = 'auto';
                    return; // 成功加载位置，直接返回
                }
            }
        } catch (error) {
            console.error('加载面板位置失败:', error);
            // 如果加载失败，则会继续执行下面的默认定位
        }

        // 如果没有保存的位置或加载失败，则使用默认位置
        panel.style.bottom = '20px';
        panel.style.right = '20px';
    }


    function main() {
        if (document.body) {
            buildUI();
            addEventListeners();
            loadCachedHandle();
            loadPanelPosition(); // 【新增】调用加载位置的函数
        } else {
            window.addEventListener('DOMContentLoaded', main);
        }
    }

    main();

})();