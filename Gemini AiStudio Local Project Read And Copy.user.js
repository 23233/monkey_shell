// ==UserScript==
// @name         本地项目文件内容读取工具 (v2.1-CSP兼容修复)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  通过选择本地文件夹，构建可折叠/展开的文件树，支持过滤，支持多选，一键复制"路径+内容"到剪贴板。现已支持保存和管理多个项目，并修复了CSP兼容性问题。
// @author       23233
// @match        *://aistudio.google.com/*
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 配置区域 ---
    const foldersToIgnore = ['.git', '.idea', 'node_modules', '__pycache__', "logs"]; // 忽略的文件夹名称
    const prefix = 'upc-'; // 所有CSS类名和ID的前缀，防止冲突
    const positionStorageKey = `${prefix}panel-position`; // localStorage中保存面板位置的键名
    const lastProjectKey = `${prefix}last-active-project`; // localStorage中保存上个激活项目名称的键名

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

    async function getAllHandleKeys() {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAllKeys();
            request.onsuccess = () => resolve(request.result.sort());
            request.onerror = (event) => reject('Transaction error: ' + event.target.errorCode);
        });
    }

    async function deleteHandle(key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = (event) => reject('Transaction error: ' + event.target.errorCode);
        });
    }

    // --- 全局变量 ---
    let rootDirectoryHandle = null;

    // --- UI 构建 ---
    function buildUI() {
        const panel = document.createElement('div');
        panel.id = `${prefix}panel`;

        const header = document.createElement('div');
        header.id = `${prefix}header`;
        const headerTitle = document.createElement('span');
        headerTitle.textContent = '项目文件读取工具';
        const toggleBtn = document.createElement('button');
        toggleBtn.id = `${prefix}toggle-btn`;
        toggleBtn.textContent = '+';
        header.appendChild(headerTitle);
        header.appendChild(toggleBtn);

        const body = document.createElement('div');
        body.id = `${prefix}body`;
        body.classList.add(`${prefix}hidden`);

        const controls = document.createElement('div');
        controls.id = `${prefix}controls`;

        const projectManager = document.createElement('div');
        projectManager.id = `${prefix}project-manager`;

        const projectSelector = document.createElement('select');
        projectSelector.id = `${prefix}project-selector`;
        projectSelector.title = '切换已保存的项目';

        const addProjectBtn = document.createElement('button');
        addProjectBtn.id = `${prefix}add-project-btn`;
        addProjectBtn.title = '选择并添加一个新的本地项目文件夹';
        addProjectBtn.textContent = '✚ 添加';

        const removeProjectBtn = document.createElement('button');
        removeProjectBtn.id = `${prefix}remove-project-btn`;
        removeProjectBtn.title = '从列表中移除当前选中的项目';
        removeProjectBtn.textContent = '✖ 移除';

        const refreshTreeBtn = document.createElement('button');
        refreshTreeBtn.id = `${prefix}refresh-tree-btn`;
        refreshTreeBtn.title = '重新加载当前项目的文件树';
        refreshTreeBtn.textContent = '↻ 刷新';

        projectManager.appendChild(projectSelector);
        projectManager.appendChild(addProjectBtn);
        projectManager.appendChild(removeProjectBtn);
        projectManager.appendChild(refreshTreeBtn);
        controls.appendChild(projectManager);

        const fileTreeContainer = document.createElement('div');
        fileTreeContainer.id = `${prefix}file-tree-container`;
        fileTreeContainer.setAttribute('placeholder', '请从上方选择一个项目，或添加新项目...');

        const copyContentBtn = document.createElement('button');
        copyContentBtn.id = `${prefix}copy-content-btn`;
        copyContentBtn.textContent = '复制选中内容到剪贴板';

        const statusDiv = document.createElement('div');
        statusDiv.id = `${prefix}status`;

        body.appendChild(controls);
        body.appendChild(fileTreeContainer);
        body.appendChild(copyContentBtn);
        body.appendChild(statusDiv);

        panel.appendChild(header);
        panel.appendChild(body);
        document.body.appendChild(panel);

        const css = `
            #${prefix}panel { position: fixed; width: 400px; max-width: 90vw; max-height: 80vh; background-color: #f0f0f0; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; color: #333; }
            #${prefix}header { padding: 8px 12px; background-color: #e0e0e0; cursor: move; border-bottom: 1px solid #ccc; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
            #${prefix}body { padding: 12px; display: flex; flex-direction: column; overflow: hidden; }
            #${prefix}body.${prefix}hidden { display: none; }
            #${prefix}controls { margin-bottom: 12px; }
            #${prefix}project-manager { display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; align-items: center; }
            #${prefix}project-selector { width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; }
            #${prefix}panel button { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background-color: #fff; cursor: pointer; transition: background-color 0.2s; white-space: nowrap; }
            #${prefix}panel button:hover:not(:disabled) { background-color: #e6e6e6; }
            #${prefix}panel button:disabled { cursor: not-allowed; background-color: #f8f8f8; color: #aaa; }
            #${prefix}file-tree-container { flex-grow: 1; overflow-y: auto; border: 1px solid #ccc; padding: 8px; background-color: #fff; min-height: 150px; margin-bottom: 12px; }
            #${prefix}file-tree-container:empty::before { content: attr(placeholder); color: #999; }
            #${prefix}status { font-size: 12px; color: green; text-align: center; min-height: 1em; }
            .${prefix}tree-ul { list-style-type: none; padding-left: 20px; }
            .${prefix}tree-li { margin: 4px 0; }
            .${prefix}tree-li label { display: flex; align-items: center; }
            .${prefix}tree-li input[type="checkbox"] { margin-right: 8px; }
            .${prefix}folder-label { cursor: pointer; }
            .${prefix}folder-label::before { content: '📁'; margin-right: 4px; }
            .${prefix}file-label::before { content: '📄'; margin-right: 4px; }
            .${prefix}folder-label.${prefix}collapsible::before { content: '+ 📁'; font-family: monospace; }
            .${prefix}folder-label.${prefix}collapsible.${prefix}expanded::before { content: '- 📁'; font-family: monospace; }
            .${prefix}tree-ul.${prefix}nested { display: none; }
            .${prefix}tree-ul.${prefix}nested.${prefix}active { display: block; }
        `;
        GM_addStyle(css);
    }

    // --- 功能实现 ---

    function updateUI() {
        const hasActiveProject = !!rootDirectoryHandle;
        document.getElementById(`${prefix}copy-content-btn`).disabled = !hasActiveProject;
        document.getElementById(`${prefix}remove-project-btn`).disabled = !hasActiveProject;
        document.getElementById(`${prefix}refresh-tree-btn`).disabled = !hasActiveProject;
        const selector = document.getElementById(`${prefix}project-selector`);
        if (selector.options.length === 0) {
            document.getElementById(`${prefix}remove-project-btn`).disabled = true;
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
            // 【修复】使用 replaceChildren 替代 innerHTML
            container.replaceChildren();
            updateUI();
            return;
        }
        container.textContent = '正在加载文件树...';
        if (await verifyPermission(rootDirectoryHandle)) {
            const treeUl = await createFileTree(rootDirectoryHandle, '');
            // 【修复】使用 replaceChildren 替代 innerHTML
            container.replaceChildren(treeUl);
        } else {
            container.textContent = '';
            showStatus(`项目 "${rootDirectoryHandle.name}" 需要授权，请刷新。`);
            rootDirectoryHandle = null;
        }
        updateUI();
    }

    async function verifyPermission(handle) {
        if (await handle.queryPermission({ mode: 'read' }) === 'granted') {
            return true;
        }
        if (await handle.requestPermission({ mode: 'read' }) === 'granted') {
            return true;
        }
        return false;
    }

    async function populateProjectSelector() {
        const selector = document.getElementById(`${prefix}project-selector`);
        const savedKeys = await getAllHandleKeys();
        // 【修复】使用 replaceChildren 替代 innerHTML
        selector.replaceChildren();
        if (savedKeys.length === 0) {
            const defaultOption = document.createElement('option');
            defaultOption.textContent = '暂无项目';
            selector.appendChild(defaultOption);
            selector.disabled = true;
        } else {
            savedKeys.forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = key;
                selector.appendChild(option);
            });
            selector.disabled = false;
        }
    }

    async function switchProject(projectName) {
        if (!projectName) {
            rootDirectoryHandle = null;
            await renderFileTree();
            return;
        }
        try {
            const handle = await getHandle(projectName);
            if (handle) {
                rootDirectoryHandle = handle;
                localStorage.setItem(lastProjectKey, projectName);
                document.getElementById(`${prefix}project-selector`).value = projectName;
                await renderFileTree();
                showStatus(`已切换到项目: ${projectName}`);
            } else {
                throw new Error("在数据库中找不到该项目");
            }
        } catch (error) {
            console.error(`切换项目 "${projectName}" 失败:`, error);
            showStatus(`切换项目失败，可能已被移除。`);
            localStorage.removeItem(lastProjectKey);
            rootDirectoryHandle = null;
            await populateProjectSelector();
            await renderFileTree();
        }
    }

    function handleCheckboxChange(e) {
        if (e.target.type !== 'checkbox') return;
        const li = e.target.closest(`.${prefix}tree-li`);
        if (!li || !li.classList.contains(`${prefix}folder-entry`)) return;
        const isChecked = e.target.checked;
        const subCheckboxes = li.querySelectorAll('input[type="checkbox"]');
        subCheckboxes.forEach(cb => cb.checked = isChecked);
    }

    async function addNewProject() {
        try {
            const handle = await window.showDirectoryPicker();
            if (handle) {
                await setHandle(handle.name, handle);
                await populateProjectSelector();
                await switchProject(handle.name);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("选择文件夹时发生错误:", err);
                showStatus("选择文件夹失败！");
            }
        }
    }

    async function removeCurrentProject() {
        const selector = document.getElementById(`${prefix}project-selector`);
        const projectNameToRemove = selector.value;
        if (!projectNameToRemove || selector.options.length === 0) {
            showStatus("没有可移除的项目。");
            return;
        }
        if (confirm(`确定要从列表中移除项目 "${projectNameToRemove}" 吗？\n(这不会删除你本地的实际文件夹)`)) {
            try {
                await deleteHandle(projectNameToRemove);
                showStatus(`项目 "${projectNameToRemove}" 已被移除。`);
                if (rootDirectoryHandle && rootDirectoryHandle.name === projectNameToRemove) {
                    rootDirectoryHandle = null;
                }
                await populateProjectSelector();
                const nextProjectName = selector.value || null;
                await switchProject(nextProjectName);
                if (!nextProjectName) {
                    // 【修复】使用 replaceChildren 替代 innerHTML
                    document.getElementById(`${prefix}file-tree-container`).replaceChildren();
                    updateUI();
                }
            } catch (error) {
                console.error("移除项目时发生错误:", error);
                showStatus("移除项目失败！");
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
                    if (await verifyPermission(fileHandle)) {
                        const file = await fileHandle.getFile();
                        const content = await file.text();
                        finalContent += `// File: ${path}\n`;
                        finalContent += content;
                        finalContent += `\n\n`;
                    } else {
                        showStatus(`跳过文件（无权限）: ${path}`);
                    }
                }
                processedFiles++;
                copyBtn.textContent = `读取中 (${processedFiles}/${totalFiles})...`;
            }
            await navigator.clipboard.writeText(finalContent);
            showStatus(`成功复制 ${processedFiles} 个文件的内容！`);
            copyBtn.textContent = '复制成功!';
            setTimeout(() => {
                copyBtn.textContent = '复制选中内容到剪贴板';
            }, 2000);
        } catch (error) {
            console.error("复制内容时发生错误:", error);
            showStatus("复制失败！详情请查看控制台。");
            copyBtn.textContent = '复制选中内容到剪贴板';
        } finally {
            copyBtn.disabled = false;
        }
    }

    async function loadProjectsAndRestoreState() {
        await populateProjectSelector();
        const lastProjectName = localStorage.getItem(lastProjectKey);
        const selector = document.getElementById(`${prefix}project-selector`);
        const projectExists = Array.from(selector.options).some(opt => opt.value === lastProjectName);

        if (lastProjectName && projectExists) {
            await switchProject(lastProjectName);
        } else {
            updateUI();
        }
    }

    function handleTreeClick(e) {
        const label = e.target.closest(`.${prefix}folder-label`);
        if (!label || e.target.type === 'checkbox') return;
        e.preventDefault();
        const li = label.closest(`.${prefix}folder-entry`);
        const nestedList = li.querySelector(`.${prefix}tree-ul.${prefix}nested`);
        if (nestedList) {
            label.classList.toggle(`${prefix}expanded`);
            nestedList.classList.toggle(`${prefix}active`);
        }
    }

    function addEventListeners() {
        document.getElementById(`${prefix}add-project-btn`).addEventListener('click', addNewProject);
        document.getElementById(`${prefix}remove-project-btn`).addEventListener('click', removeCurrentProject);
        document.getElementById(`${prefix}refresh-tree-btn`).addEventListener('click', renderFileTree);
        document.getElementById(`${prefix}project-selector`).addEventListener('change', (e) => switchProject(e.target.value));
        document.getElementById(`${prefix}copy-content-btn`).addEventListener('click', copyContent);
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
            panel.style.left = `${e.clientX - offset.x}px`;
            panel.style.top = `${e.clientY - offset.y}px`;
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            panel.style.userSelect = 'auto';
            try {
                localStorage.setItem(positionStorageKey, JSON.stringify({ top: panel.style.top, left: panel.style.left }));
            } catch (error) { console.error('保存面板位置失败:', error); }
        });
        document.getElementById(`${prefix}toggle-btn`).addEventListener('click', () => {
            const body = document.getElementById(`${prefix}body`);
            body.classList.toggle(`${prefix}hidden`);
            document.getElementById(`${prefix}toggle-btn`).textContent = body.classList.contains(`${prefix}hidden`) ? '+' : '-';
        });
    }

    function loadPanelPosition() {
        const panel = document.getElementById(`${prefix}panel`);
        try {
            const savedPosition = localStorage.getItem(positionStorageKey);
            if (savedPosition) {
                const pos = JSON.parse(savedPosition);
                if (pos && pos.top && pos.left) {
                    panel.style.top = pos.top;
                    panel.style.left = pos.left;
                    panel.style.bottom = 'auto';
                    panel.style.right = 'auto';
                    return;
                }
            }
        } catch (error) {
            console.error('加载面板位置失败:', error);
        }
        panel.style.bottom = '20px';
        panel.style.right = '20px';
    }

    function main() {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            buildUI();
            addEventListeners();
            loadProjectsAndRestoreState();
            loadPanelPosition();
        } else {
            window.addEventListener('DOMContentLoaded', main, { once: true });
        }
    }

    main();

})();