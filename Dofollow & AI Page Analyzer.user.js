// ==UserScript==
// @name         SEO页面内容分析器 (美化修复版)
// @namespace    http://tampermonkey.net/
// @version      3.7
// @description  分析Dofollow外链, AI分析页面内容, 支持链接跳转导航, 并可提交链接到外部系统. 修复了TrustedHTML并美化了UI, 新增每日提交计数和提交前存在性检查功能, 优化了提交和API密钥处理逻辑.
// @author       23233 (由Gemini修改)
// @match        *://*/*
// @connect      entry.a0go.com
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(async function() {
    'use strict';

    if (window.self !== window.top) return;

    // --- 全局变量和配置 ---
    const CUSTOM_BASE_URL = "http://entry.a0go.com:7544";
    const EXTERNAL_LINK_API_URL = "http://entry.a0go.com:6247/api/links/external";
    const LINK_EXISTS_API_URL = "http://entry.a0go.com:6247/api/links/exists/url"; // 新增: 存在性检查API
    const MODEL_NAME = "gemini-2.5-pro";
    const DOFOLLOW_THRESHOLD = 5;
    let geminiApiKey = null, apiToken = null, dofollowLinks = [], currentLinkIndex = -1, isPageFullyLoaded = false;
    let submissionCountData = { date: '', count: 0 };


    // --- 样式注入 (美化更新) ---
    GM_addStyle(`
        #ai-analyzer-toggle-btn { position: fixed; bottom: 20px; right: 30px; min-width: 40px; height: 40px; padding: 0 12px; background-color: #007bff; color: white; border: none; border-radius: 20px; font-size: 18px; font-weight: bold; cursor: pointer; z-index: 100000; box-shadow: 0 4px 8px rgba(0,0,0,0.2); display: flex; justify-content: center; align-items: center; line-height: 40px; }
        #ai-analyzer-panel { position: fixed; bottom: 80px; right: 20px; width: 450px; max-height: 600px; background-color: #f9f9f9; border: 1px solid #ccc; border-radius: 8px; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .ai-analyzer-header { padding: 10px 15px; background-color: #f1f1f1; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; cursor: move; }
        .header-left { display: flex; align-items: center; }
        .ai-analyzer-header h3 { margin: 0; font-size: 16px; color: #333; }
        #external-link-counter { font-size: 14px; color: #555; margin-left: 10px; font-weight: normal; }
        #dofollow-nav-controls { margin-left: 8px; display: none; }
        .dofollow-nav-arrow { font-size: 16px; cursor: pointer; user-select: none; padding: 0 4px; color: #333; font-weight: bold; }
        .dofollow-nav-arrow:hover { color: #007bff; }
        .highlighted-dofollow-link { outline: 3px solid #007bff !important; box-shadow: 0 0 15px rgba(0, 123, 255, 0.7) !important; border-radius: 3px; transition: outline 0.2s ease-in-out, box-shadow 0.2s ease-in-out; }
        .ai-analyzer-body { padding: 15px; overflow-y: auto; color: #333; flex-grow: 1; }
        #ai-settings-btn { font-size: 20px; cursor: pointer; user-select: none; }
        #ai-settings-area { display: none; padding: 15px; background-color: #e9ecef; border-radius: 4px; }
        #ai-settings-area label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; }
        #ai-settings-area input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 8px; transition: border-color 0.2s ease; }
        .settings-btn { width: 100%; padding: 8px; border-radius: 4px; border: none; color: white; cursor: pointer; margin-top: 5px; transition: background-color 0.2s ease; }
        #save-gemini-key-btn { background-color: #28a745; }
        #save-gemini-key-btn:hover { background-color: #218838; }
        #save-api-token-btn { background-color: #17a2b8; }
        #save-api-token-btn:hover { background-color: #117a8b; }
        .action-btn { width: 100%; padding: 12px; font-size: 16px; font-weight: bold; cursor: pointer; color: white; border: none; border-radius: 5px; margin-bottom: 10px; transition: background-color 0.2s ease; }
        .action-btn:disabled { background-color: #6c757d; cursor: not-allowed; opacity: 0.7; }
        .btn-analyze { background-color: #28a745; } /* Green */
        .btn-analyze:hover:not(:disabled) { background-color: #218838; }
        .btn-submit-link { background-color: #007bff; } /* Blue */
        .btn-submit-link:hover:not(:disabled) { background-color: #0069d9; }
        #copy-table-btn { background-color: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-top: 15px; float: right; transition: background-color 0.2s ease; }
        #copy-table-btn:hover { background-color: #0069d9; }
        .status-message { font-style: italic; color: #666; margin-top: 10px; }
        .success-message { color: #28a745; font-weight: bold; }
        .error-message { color: #d9534f; font-weight: bold; white-space: pre-wrap; word-wrap: break-word; }
        #ai-analyzer-panel table { width: 100%; border-collapse: collapse; margin-top: 10px; background-color: #FFFFFF; }
        #ai-analyzer-panel th, #ai-analyzer-panel td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; word-break: break-all; }
        #ai-analyzer-panel th { background-color: #f2f2f2; font-weight: bold; }
        .link-follow-indicator { position: fixed; background-color: rgba(0, 0, 0, 0.75); color: white; padding: 2px 5px; border-radius: 3px; font-size: 12px; z-index: 10001; pointer-events: none; opacity: 0; transform: translateY(10px); animation: dofollow-fade-in-up 0.4s ease-out forwards; }
        @keyframes dofollow-fade-in-up { to { opacity: 1; transform: translateY(0); } }
        #link-submission-form h4 { text-align: center; margin-top: 0; margin-bottom: 15px; color: #333; }
        .form-url-display { font-size: 12px; color: #666; word-break: break-all; background: #eee; padding: 5px; border-radius: 3px; margin-bottom: 10px; text-align: center; }
        .form-group { margin-bottom: 12px; display: flex; align-items: center; }
        .form-group label { flex: 0 0 100px; font-size: 14px; }
        .form-input { flex-grow: 1; width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .form-checkbox-group { display: flex; align-items: center; margin-bottom: 12px; }
        .form-checkbox-group label { margin-left: 8px; user-select: none; }
        .form-actions { display: flex; justify-content: space-between; margin-top: 20px; }
        .form-actions button { width: 48%; padding: 10px; border-radius: 5px; border: none; color: white; font-size: 15px; cursor: pointer; transition: background-color 0.2s ease; }
        #submit-link-btn { background-color: #007bff; }
        #submit-link-btn:hover { background-color: #0069d9; }
        #cancel-submission-btn { background-color: #6c757d; }
        #cancel-submission-btn:hover { background-color: #5a6268; }
        #submission-count-display { text-align: center; color: #666; font-size: 14px; margin-top: 15px; padding: 5px; background: #e9ecef; border-radius: 4px;}
    `);

    // --- DOM 元素 ---
    const panel = document.createElement('div');
    panel.id = 'ai-analyzer-panel';
    const toggleButton = document.createElement('button');
    toggleButton.id = 'ai-analyzer-toggle-btn';
    toggleButton.textContent = '?';
    document.body.appendChild(toggleButton);
    document.body.appendChild(panel);

    let resultsDiv, settingsBtn, settingsArea, geminiApiKeyInput, apiTokenInput, saveGeminiKeyBtn, saveApiTokenBtn, currentIndicator = null;

    // --- DOM 操作工具函数 ---
    const clearElement = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
    const createSimpleElement = (tag, { id, className, textContent, title, type, style } = {}) => {
        const el = document.createElement(tag);
        if (id) el.id = id;
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        if (title) el.title = title;
        if (type) el.type = type;
        if (style) el.style.cssText = style;
        return el;
    };
    const displayMessage = (container, message, className, allowHtml = false) => {
        clearElement(container);
        const p = createSimpleElement('p', { className });
        if (allowHtml) {
            const parts = message.split('<br>');
            parts.forEach((part, index) => {
                p.appendChild(document.createTextNode(part));
                if (index < parts.length - 1) p.appendChild(createSimpleElement('br'));
            });
        } else {
            p.textContent = message;
        }
        container.appendChild(p);
    };

    // --- UI 构建 ---
    function buildInitialPanel() {
        clearElement(panel);
        const header = createSimpleElement('div', { className: 'ai-analyzer-header' });
        const headerLeft = createSimpleElement('div', { className: 'header-left' });
        headerLeft.appendChild(createSimpleElement('h3', { textContent: '页面分析助手' }));
        headerLeft.appendChild(createSimpleElement('span', { id: 'external-link-counter', title: '页面Dofollow外链数量' }));
        const navControls = createSimpleElement('span', { id: 'dofollow-nav-controls' });
        navControls.appendChild(createSimpleElement('span', { id: 'dofollow-nav-up', className: 'dofollow-nav-arrow', title: '上一个Dofollow链接', textContent: '▲' }));
        navControls.appendChild(createSimpleElement('span', { id: 'dofollow-nav-down', className: 'dofollow-nav-arrow', title: '下一个Dofollow链接', textContent: '▼' }));
        headerLeft.appendChild(navControls);
        header.appendChild(headerLeft);
        settingsBtn = createSimpleElement('span', { id: 'ai-settings-btn', title: '设置', textContent: '⚙️' });
        header.appendChild(settingsBtn);

        resultsDiv = createSimpleElement('div', { id: 'ai-analyzer-results', className: 'ai-analyzer-body' });

        settingsArea = createSimpleElement('div', { id: 'ai-settings-area' });
        const geminiDiv = createSimpleElement('div');
        geminiDiv.appendChild(createSimpleElement('label', { textContent: 'Gemini API Key:' })).htmlFor = 'gemini-api-key-input';
        geminiApiKeyInput = createSimpleElement('input', { id: 'gemini-api-key-input', type: 'password', title: '用于AI分析的Gemini sk-密钥' });
        geminiApiKeyInput.placeholder = '用于AI分析的Gemini sk-密钥';
        geminiDiv.appendChild(geminiApiKeyInput);
        saveGeminiKeyBtn = createSimpleElement('button', { id: 'save-gemini-key-btn', className: 'settings-btn', textContent: '保存Gemini Key' });
        geminiDiv.appendChild(saveGeminiKeyBtn);
        settingsArea.appendChild(geminiDiv);
        settingsArea.appendChild(Object.assign(document.createElement('hr'), { style: 'margin: 15px 0; border: 0; border-top: 1px solid #ccc;' }));
        const tokenDiv = createSimpleElement('div');
        tokenDiv.appendChild(createSimpleElement('label', { textContent: 'External Link API Token:' })).htmlFor = 'api-token-input';
        apiTokenInput = createSimpleElement('input', { id: 'api-token-input', type: 'password', title: '用于提交外链的Token' });
        apiTokenInput.placeholder = '用于提交外链的Token';
        tokenDiv.appendChild(apiTokenInput);
        saveApiTokenBtn = createSimpleElement('button', { id: 'save-api-token-btn', className: 'settings-btn', textContent: '保存Token' });
        tokenDiv.appendChild(saveApiTokenBtn);
        settingsArea.appendChild(tokenDiv);

        panel.appendChild(header);
        panel.appendChild(resultsDiv);
        panel.appendChild(settingsArea);
    }

    // --- 核心逻辑 ---
    function setInitialState() {
        clearElement(resultsDiv);
        const runBtn = createSimpleElement('button', { id: 'run-analysis-btn', className: 'action-btn btn-analyze' });
        if (isPageFullyLoaded) {
            runBtn.disabled = false;
            runBtn.textContent = '手动分析当前页面';
            runBtn.title = '开始分析页面内容和外链';
        } else {
            runBtn.disabled = true;
            runBtn.textContent = '分析 (加载中...)';
            runBtn.title = '等待页面完全加载...';
        }
        runBtn.addEventListener('click', runAnalysis);
        const submitBtn = createSimpleElement('button', { id: 'show-submission-form-btn', className: 'action-btn btn-submit-link', textContent: '提交当前链接' });
        submitBtn.addEventListener('click', handleShowSubmissionFormClick); // [MODIFIED] 调用新的检查函数
        resultsDiv.appendChild(runBtn);
        resultsDiv.appendChild(submitBtn);
    }

    async function loadAndCheckSubmissionCount() {
        const today = new Date().toISOString().split('T')[0];
        try {
            const storedData = JSON.parse(await GM_getValue('SUBMISSION_COUNT_DATA', '{}'));
            if (storedData.date === today && typeof storedData.count === 'number') {
                submissionCountData = storedData;
            } else {
                submissionCountData = { date: today, count: 0 };
                await GM_setValue('SUBMISSION_COUNT_DATA', JSON.stringify(submissionCountData));
            }
        } catch (e) {
            console.error("Error handling submission count data:", e);
            submissionCountData = { date: today, count: 0 };
            await GM_setValue('SUBMISSION_COUNT_DATA', JSON.stringify(submissionCountData));
        }
    }


    function scanAndPrepareDofollowLinks() {
        dofollowLinks = [];
        currentLinkIndex = -1;
        const currentHostname = window.location.hostname;
        document.querySelectorAll('a[href]').forEach(link => {
            try {
                if (!link.href || !link.offsetParent) return;
                const linkUrl = new URL(link.href, window.location.href);
                if (linkUrl.hostname && linkUrl.hostname !== currentHostname) {
                    const rel = link.getAttribute('rel') || '';
                    if (!rel.toLowerCase().includes('nofollow')) {
                        dofollowLinks.push(link);
                    }
                }
            } catch (e) { /* 忽略无效URL */ }
        });
        const dofollowCount = dofollowLinks.length;
        const counter = document.getElementById('external-link-counter');
        if(counter) counter.textContent = `(Dofollow: ${dofollowCount})`;
        toggleButton.textContent = dofollowCount;
        const navControls = document.getElementById('dofollow-nav-controls');
        if(navControls) navControls.style.display = dofollowCount > 0 ? 'inline-block' : 'none';
    }
    function navigateToDofollowLink(direction) {
        if (dofollowLinks.length === 0) return;
        if (dofollowLinks[currentLinkIndex]) {
            dofollowLinks[currentLinkIndex].classList.remove('highlighted-dofollow-link');
        }
        if (direction === 'next') {
            currentLinkIndex = (currentLinkIndex + 1) % dofollowLinks.length;
        } else {
            currentLinkIndex = (currentLinkIndex - 1 + dofollowLinks.length) % dofollowLinks.length;
        }
        const targetLink = dofollowLinks[currentLinkIndex];
        if (targetLink) {
            targetLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetLink.classList.add('highlighted-dofollow-link');
            setTimeout(() => targetLink.classList.remove('highlighted-dofollow-link'), 2000);
        }
    }
    function showIndicatorForLink(link, duration) {
        const isNofollow = link.rel && link.rel.toLowerCase().includes('nofollow');
        const indicatorText = isNofollow ? 'NoF' : 'F';
        const indicatorColor = isNofollow ? '#d9534f' : '#28a745';
        const indicator = document.createElement('div');
        indicator.className = 'link-follow-indicator';
        indicator.textContent = indicatorText;
        indicator.style.backgroundColor = indicatorColor;
        document.body.appendChild(indicator);
        const linkRect = link.getBoundingClientRect();
        const indicatorRect = indicator.getBoundingClientRect();
        let top = linkRect.top + window.scrollY - indicatorRect.height - 5;
        let left = linkRect.left + window.scrollX + (linkRect.width / 2) - (indicatorRect.width / 2);
        if (top < window.scrollY + 5) { top = linkRect.bottom + window.scrollY + 5; }
        if (left < 0) left = 5;
        if (left + indicatorRect.width > window.innerWidth) left = window.innerWidth - indicatorRect.width - 5;
        indicator.style.top = `${top}px`;
        indicator.style.left = `${left}px`;
        setTimeout(() => indicator.remove(), duration);
        return indicator;
    }
    function setupIntersectionObserverForLinks() {
        const currentHostname = window.location.hostname;
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    showIndicatorForLink(entry.target, 800);
                    obs.unobserve(entry.target);
                }
            });
        }, { root: null, rootMargin: '0px', threshold: 0.1 });
        document.querySelectorAll('a[href]').forEach(link => {
            try {
                if (new URL(link.href).hostname !== currentHostname) {
                    observer.observe(link);
                }
            } catch (e) { /* 忽略无效URL */ }
        });
    }
    function setupLinkHoverIndicator() {
        const currentHostname = window.location.hostname;
        document.body.addEventListener('mouseover', event => {
            const link = event.target.closest('a[href]');
            if (!link) return;
            try {
                if (new URL(link.href).hostname === currentHostname) return;
            } catch (e) { return; }
            if (currentIndicator) {
                clearTimeout(currentIndicator.timeoutId);
                currentIndicator.remove();
            }
            const indicator = showIndicatorForLink(link, 600);
            currentIndicator = indicator;
            indicator.timeoutId = setTimeout(() => { currentIndicator = null; }, 600);
        });
    }

    // [NEW] 点击“提交链接”按钮后的处理函数
    async function handleShowSubmissionFormClick() {
        if (!apiToken) {
            settingsArea.style.display = 'block';
            apiTokenInput.focus();
            apiTokenInput.style.border = '2px solid #d9534f';
            return;
        }

        displayMessage(resultsDiv, '正在检查链接是否存在...', 'status-message');

        GM_xmlhttpRequest({
            method: "POST",
            url: LINK_EXISTS_API_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({ url: window.location.href }),
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const resData = JSON.parse(response.responseText);
                        if (resData?.data?.exists === true) {
                            displayMessage(resultsDiv, '提示：当前域名已收录。', 'status-message success-message');
                            const backButton = createSimpleElement('button', { textContent: '返回', className: 'action-btn' });
                            backButton.style.marginTop = '10px';
                            backButton.style.backgroundColor = '#6c757d';
                            backButton.addEventListener('click', setInitialState);
                            resultsDiv.appendChild(backButton);
                        } else {
                            displaySubmissionForm(); // 链接不存在，显示表单
                        }
                    } catch (e) {
                        console.error("Link Exists Check - Parsing Error:", e, "Raw Response:", response.responseText);
                        displayMessage(resultsDiv, `检查失败: 无法解析服务器响应。<br>${e.message}`, 'error-message', true);
                    }
                } else {
                    displayMessage(resultsDiv, `检查链接失败: ${response.status} - ${response.statusText}`, 'error-message');
                }
            },
            onerror: function(error) {
                console.error("Link Exists Check - XHR Error:", error);
                displayMessage(resultsDiv, '检查链接错误: 无法连接到服务器。请检查控制台。', 'error-message');
            }
        });
    }

    async function displaySubmissionForm() {
        // [MODIFIED] Token检查已移至 handleShowSubmissionFormClick
        clearElement(resultsDiv);
        const form = createSimpleElement('form', { id: 'link-submission-form' });
        form.noValidate = true;

        form.appendChild(createSimpleElement('h4', { textContent: '提交当前页面链接' }));
        form.appendChild(createSimpleElement('p', { className: 'form-url-display', textContent: `URL: ${window.location.href}` }));

        const createFormGroup = (label, input) => {
            const group = createSimpleElement('div', { className: 'form-group' });
            const lbl = createSimpleElement('label', { textContent: label });
            lbl.htmlFor = input.id;
            group.appendChild(lbl);
            group.appendChild(input);
            return group;
        };

        const asInput = createSimpleElement('input', { id: 'form-as', className: 'form-input', type: 'number', title: 'AS' });
        asInput.value = "0"; asInput.min = "0";
        form.appendChild(createFormGroup('AS:', asInput));

        const drInput = createSimpleElement('input', { id: 'form-dr', className: 'form-input', type: 'number', title: 'DR' });
        drInput.value = "0"; drInput.min = "0";
        form.appendChild(createFormGroup('DR:', drInput));

        const createCheckbox = (id, labelText) => {
            const group = createSimpleElement('div', { className: 'form-checkbox-group' });
            const chk = createSimpleElement('input', { id, type: 'checkbox' });
            const lbl = createSimpleElement('label', { textContent: labelText });
            lbl.htmlFor = id;
            group.appendChild(chk);
            group.appendChild(lbl);
            return group;
        };

        form.appendChild(createCheckbox('form-need-login', '需要登录 (Need Login)'));
        form.appendChild(createCheckbox('form-has-capture', '有验证码 (Has Capture)'));

        const captureTypeInput = createSimpleElement('input', { id: 'form-capture-type', className: 'form-input', type: 'text' });
        captureTypeInput.placeholder = "例如: reCAPTCHA";
        form.appendChild(createFormGroup('验证码类型:', captureTypeInput));

        const remarksInput = createSimpleElement('textarea', { id: 'form-remarks', className: 'form-input' });
        remarksInput.rows = 3; remarksInput.maxLength = 2000;
        form.appendChild(createFormGroup('备注:', remarksInput));

        const actions = createSimpleElement('div', { className: 'form-actions' });
        const submitBtn = createSimpleElement('button', { id: 'submit-link-btn', type: 'submit', textContent: '确认提交' });
        const cancelBtn = createSimpleElement('button', { id: 'cancel-submission-btn', type: 'button', textContent: '取消' });
        cancelBtn.addEventListener('click', setInitialState);
        actions.appendChild(submitBtn);
        actions.appendChild(cancelBtn);
        form.appendChild(actions);

        form.appendChild(createSimpleElement('div', { id: 'submission-status' }));
        form.appendChild(createSimpleElement('div', {
            id: 'submission-count-display',
            textContent: `今日提交成功数量: ${submissionCountData.count}`
        }));

        form.addEventListener('submit', handleFormSubmission);
        resultsDiv.appendChild(form);
    }
    async function handleFormSubmission(event) {
        event.preventDefault();
        const statusDiv = document.getElementById('submission-status');
        const submitBtn = document.getElementById('submit-link-btn');
        statusDiv.className = 'status-message';
        statusDiv.textContent = '正在提交...';
        submitBtn.disabled = true;

        const payload = {
            token: apiToken,
            full_url: window.location.href,
            as: parseInt(document.getElementById('form-as').value, 10) || 0,
            dr: parseInt(document.getElementById('form-dr').value, 10) || 0,
            need_login: document.getElementById('form-need-login').checked,
            has_capture: document.getElementById('form-has-capture').checked,
            capture_type: document.getElementById('form-capture-type').value.trim(),
            remarks: document.getElementById('form-remarks').value.trim()
        };

        GM_xmlhttpRequest({
            method: "POST",
            url: EXTERNAL_LINK_API_URL,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(payload),
            onload: async function(response) {
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const resData = JSON.parse(response.responseText);
                        if (resData?.data?.action === 'created') {
                            submissionCountData.count++;
                            await GM_setValue('SUBMISSION_COUNT_DATA', JSON.stringify(submissionCountData));
                            statusDiv.className = 'status-message success-message';
                            statusDiv.textContent = '提交成功!';
                            const countDisplay = document.getElementById('submission-count-display');
                            if(countDisplay) {
                                countDisplay.textContent = `今日提交成功数量: ${submissionCountData.count}`;
                            }
                            setTimeout(setInitialState, 2000);
                        } else {
                            statusDiv.className = 'status-message';
                            statusDiv.textContent = '提示: 该链接已存在, 未重复添加.';
                            setTimeout(setInitialState, 2500);
                        }
                    } catch (e) {
                        console.error("Response Parsing Error:", e, "Raw Response:", response.responseText);
                        statusDiv.className = 'error-message';
                        statusDiv.textContent = '提交失败: 无法解析服务器响应。';
                        submitBtn.disabled = false;
                    }
                } else {
                    statusDiv.className = 'error-message';
                    statusDiv.textContent = `提交失败: ${response.status} - ${response.responseText || '无服务器响应'}`;
                    submitBtn.disabled = false;
                }
            },
            onerror: function(error) {
                console.error("Link Submission Error:", error);
                statusDiv.className = 'error-message';
                statusDiv.textContent = '提交错误: 无法连接到服务器。请检查控制台。';
                submitBtn.disabled = false;
            }
        });
    }
    function setupEventListeners() {
        toggleButton.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        });

        settingsBtn.addEventListener('click', () => {
            settingsArea.style.display = settingsArea.style.display === 'block' ? 'none' : 'block';
        });

        saveGeminiKeyBtn.addEventListener('click', async () => {
            const newKey = geminiApiKeyInput.value.trim();
            await GM_setValue('GEMINI_API_KEY', newKey);
            geminiApiKey = newKey;
            geminiApiKeyInput.style.border = '';
            saveGeminiKeyBtn.textContent = '已保存!';
            setTimeout(() => { saveGeminiKeyBtn.textContent = '保存Gemini Key'; }, 2000);
        });

        saveApiTokenBtn.addEventListener('click', async () => {
            const newToken = apiTokenInput.value.trim();
            await GM_setValue('API_TOKEN', newToken);
            apiToken = newToken;
            apiTokenInput.style.border = '';
            saveApiTokenBtn.textContent = '已保存!';
            setTimeout(() => { saveApiTokenBtn.textContent = '保存Token'; }, 2000);
        });

        panel.addEventListener('click', function(event) {
            if (event.target.id === 'dofollow-nav-up') {
                navigateToDofollowLink('prev');
            } else if (event.target.id === 'dofollow-nav-down') {
                navigateToDofollowLink('next');
            }
        });
    }
    async function runAnalysis() {
        if (!geminiApiKey) {
            settingsArea.style.display = 'block';
            geminiApiKeyInput.focus();
            geminiApiKeyInput.style.border = '2px solid #d9534f';
            return;
        }

        displayMessage(resultsDiv, '正在扫描页面Dofollow外链...', 'status-message');
        scanAndPrepareDofollowLinks();
        const dofollowCount = dofollowLinks.length;

        if (dofollowCount <= DOFOLLOW_THRESHOLD) {
            displayMessage(resultsDiv, `分析终止：页面Dofollow外链数量为 ${dofollowCount}，未超过 ${DOFOLLOW_THRESHOLD} 个的阈值。`, 'status-message');
            const resetButton = createSimpleElement('button', { textContent: '重新开始', className: 'action-btn' });
            resetButton.style.backgroundColor = '#6c757d';
            resetButton.style.marginTop = '10px';
            resetButton.onclick = setInitialState;
            resultsDiv.appendChild(resetButton);
            return;
        }

        displayMessage(resultsDiv, `检测到 ${dofollowCount} 个Dofollow外链，正在请求AI分析页面...`, 'status-message');
        callAiApi(dofollowCount > 0, geminiApiKey);
    }
    function callAiApi(hasDofollow, currentApiKey) {
        const pageHtml = document.documentElement.outerHTML;
        const prompt = `
            You are an expert webpage analyzer. Your task is to analyze the provided HTML content and return a specific JSON object.
            **INSTRUCTIONS:**
            1.  Your response MUST be a single, valid JSON object.
            2.  Do NOT include any text, explanations, or markdown formatting (like \`\`\`json) before or after the JSON object.
            3.  Analyze the HTML to determine: the page's primary purpose ('pageType'), if a user needs to be logged in ('requiresLogin'), whether there's any form of verification present ('hasVerification'), and if so, what type ('verificationType').
            **JSON STRUCTURE:**
            { "pageType": "string", "requiresLogin": boolean, "hasVerification": boolean, "verificationType": "string" }
            **FIELD DEFINITIONS:**
            - **pageType**: Classify the page's main function. Use one of these exact strings in Chinese: "评论区留言", "个人主页", "回复留言", "其他".
            - **requiresLogin**: true if a primary action (like commenting, replying, posting) requires login; otherwise false.
            - **hasVerification**: true if any captcha, security check, or human verification is clearly visible or implied for primary actions; otherwise false.
            - **verificationType**: If hasVerification is true, specify the type. Use one of these exact strings in Chinese: "reCAPTCHA", "hCaptcha", "图片验证", "数学题", "滑动验证", "短信验证", "简单人机勾选", "其他验证", "无". If hasVerification is false, this should be "无".
            **HTML to Analyze:**
            \`\`\`html
            ${pageHtml}
            \`\`\`
        `;
        const requestPayload = { contents: [{"role": "user", "parts": [{ "text": prompt }]}] };
        const apiUrl = `${CUSTOM_BASE_URL}/v1beta/models/${MODEL_NAME}:generateContent?key=${currentApiKey}`;
        GM_xmlhttpRequest({
            method: "POST", url: apiUrl, headers: { "Content-Type": "application/json" }, data: JSON.stringify(requestPayload),
            onload: function(response) {
                try {
                    const aiRawData = JSON.parse(response.responseText);
                    if (aiRawData.error) {
                        const { code, message } = aiRawData.error;
                        displayMessage(resultsDiv, `API返回错误:<br>代码: ${code}<br>消息: ${message}`, 'error-message', true);
                        return;
                    }
                    const responseText = aiRawData.candidates[0].content.parts[0].text;
                    const aiJson = JSON.parse(responseText.replace(/^```json\s*|```\s*$/g, '').trim());
                    displayResultsTable(aiJson, hasDofollow);
                } catch (error) {
                    console.error("AI Response Parsing Error:", error, "Raw Response:", response.responseText);
                    displayMessage(resultsDiv, 'AI分析失败！<br>理由: 无法解析AI返回的数据。<br>请检查控制台获取更多信息。', 'error-message', true);
                }
            },
            onerror: function(error) {
                console.error("GM_xmlhttpRequest Error:", error);
                displayMessage(resultsDiv, `AI分析失败！<br>理由: 请求未能送达至您的服务器 (${CUSTOM_BASE_URL})。<br>请检查服务器运行状态和浏览器控制台。`, 'error-message', true);
            }
        });
    }
    function displayResultsTable(aiData, hasDofollow) {
        clearElement(resultsDiv);
        const table = createSimpleElement('table', { id: 'ai-results-table' });
        const thead = createSimpleElement('thead');
        const headerRow = createSimpleElement('tr');
        ['URL', '是否需登录', '有Dofollow', '有验证', '验证类型', '备注'].forEach(text => {
            headerRow.appendChild(createSimpleElement('th', { textContent: text }));
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = createSimpleElement('tbody');
        const bodyRow = createSimpleElement('tr');
        [
            window.location.href,
            aiData.requiresLogin ? '是' : '否',
            hasDofollow ? '是' : '否',
            aiData.hasVerification ? '是' : '否',
            aiData.verificationType || '无',
            aiData.pageType || 'N/A'
        ].forEach(text => {
            bodyRow.appendChild(createSimpleElement('td', { textContent: text }));
        });
        tbody.appendChild(bodyRow);
        table.appendChild(tbody);
        resultsDiv.appendChild(table);

        const copyBtn = createSimpleElement('button', { id: 'copy-table-btn', textContent: '复制表格' });
        copyBtn.addEventListener('click', copyTableToClipboard);
        resultsDiv.appendChild(copyBtn);

        const restartBtn = createSimpleElement('button', { id: 'restart-btn', textContent: '返回主页' });
        restartBtn.style.cssText = "float: left; margin-top: 15px; background-color: #6c757d; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s ease;";
        restartBtn.onmouseover = () => restartBtn.style.backgroundColor = '#5a6268';
        restartBtn.onmouseout = () => restartBtn.style.backgroundColor = '#6c757d';
        restartBtn.addEventListener('click', setInitialState);
        resultsDiv.appendChild(restartBtn);
    }
    function copyTableToClipboard() {
        const table = document.getElementById('ai-results-table');
        if (!table) return;
        let text = Array.from(table.querySelectorAll('tr')).map(row =>
            Array.from(row.querySelectorAll('th, td'))
                .map(cell => `"${cell.innerText.replace(/"/g, '""')}"`)
                .join('\t')
        ).join('\n');
        GM_setClipboard(text.trim());
        alert('表格内容已复制到剪贴板！');
    }
    function onPageFullyLoaded() {
        isPageFullyLoaded = true;
        const analysisBtn = document.getElementById('run-analysis-btn');
        if (analysisBtn) {
            analysisBtn.disabled = false;
            analysisBtn.textContent = '手动分析当前页面';
            analysisBtn.title = '开始分析页面内容和外链';
        }
        scanAndPrepareDofollowLinks();
        setupIntersectionObserverForLinks();
        setupLinkHoverIndicator();
    }
    async function initialize() {
        await loadAndCheckSubmissionCount();
        buildInitialPanel();
        geminiApiKey = await GM_getValue('GEMINI_API_KEY', null);
        apiToken = await GM_getValue('API_TOKEN', null);
        if (geminiApiKeyInput) geminiApiKeyInput.value = geminiApiKey || '';
        if (apiTokenInput) apiTokenInput.value = apiToken || '';
        setInitialState();
        setupEventListeners();
        window.addEventListener('load', onPageFullyLoaded);
    }

    initialize();
})();