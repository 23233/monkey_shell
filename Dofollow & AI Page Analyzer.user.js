// ==UserScript==
// @name         SEO页面内容分析器
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  分析Dofollow外链, AI分析页面内容, 支持链接跳转导航, 并可提交链接到外部系统.
// @author       23233
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

    // 如果在iframe中运行，则直接终止脚本
    if (window.self !== window.top) {
        return;
    }

    // --- 全局变量和配置 ---
    const CUSTOM_BASE_URL = "http://entry.a0go.com:7544";
    const EXTERNAL_LINK_API_URL = "http://entry.a0go.com:6247/api/links/external";
    const MODEL_NAME = "gemini-2.5-pro";
    const DOFOLLOW_THRESHOLD = 5;
    let geminiApiKey = null; // 用于AI分析的Key
    let apiToken = null; // 用于提交链接的Token
    let dofollowLinks = []; // 存储页面上所有Dofollow链接的元素
    let currentLinkIndex = -1; // 当前导航到的链接索引

    // --- 注入UI样式 ---
    GM_addStyle(`
        #ai-analyzer-toggle-btn {
            position: fixed; bottom: 20px; right: 30px;
            min-width: 40px; height: 40px; padding: 0 12px;
            background-color: #007bff; color: white; border: none;
            border-radius: 20px;
            font-size: 18px; font-weight: bold; cursor: pointer;
            z-index: 100000;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            display: flex; justify-content: center; align-items: center;
            line-height: 40px;
        }
        #ai-analyzer-panel {
            position: fixed; bottom: 80px; right: 20px; width: 450px; max-height: 600px;
            background-color: #f9f9f9; border: 1px solid #ccc; border-radius: 8px;
            z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none;
            flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .ai-analyzer-header {
            padding: 10px 15px; background-color: #f1f1f1; border-bottom: 1px solid #ddd;
            display: flex; justify-content: space-between; align-items: center; cursor: move;
        }
        .header-left { display: flex; align-items: center; }
        .ai-analyzer-header h3 { margin: 0; font-size: 16px; color: #333; }
        #external-link-counter { font-size: 14px; color: #555; margin-left: 10px; font-weight: normal; }
        #dofollow-nav-controls { margin-left: 8px; display: inline-block; }
        .dofollow-nav-arrow { font-size: 16px; cursor: pointer; user-select: none; padding: 0 4px; color: #333; font-weight: bold; }
        .dofollow-nav-arrow:hover { color: #007bff; }
        .highlighted-dofollow-link {
            outline: 3px solid #007bff !important;
            box-shadow: 0 0 15px rgba(0, 123, 255, 0.7) !important;
            border-radius: 3px;
            transition: outline 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
        }
        .ai-analyzer-body { padding: 15px; overflow-y: auto; color: #333; }
        #ai-settings-btn { font-size: 20px; cursor: pointer; user-select: none; }
        #ai-settings-area { display: none; padding: 15px; background-color: #e9ecef; border-radius: 4px; }
        #ai-settings-area label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; }
        #ai-settings-area input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 8px; }
        .settings-btn { width: 100%; padding: 8px; border-radius: 4px; border: none; color: white; cursor: pointer; margin-top: 5px; }
        #save-gemini-key-btn { background-color: #28a745; }
        #save-api-token-btn { background-color: #17a2b8; }
        .action-btn { width: 100%; padding: 12px; font-size: 16px; font-weight: bold; cursor: pointer; color: white; border: none; border-radius: 5px; margin-bottom: 10px; }
        #run-analysis-btn { background-color: #28a745; }
        #show-submission-form-btn { background-color: #007bff; }
        #copy-table-btn { background-color: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-top: 15px; float: right; }
        .status-message { font-style: italic; color: #666; margin-top: 10px; }
        .success-message { color: #28a745; font-weight: bold; }
        .error-message { color: #d9534f; font-weight: bold; white-space: pre-wrap; word-wrap: break-word; }
        #ai-analyzer-panel table { width: 100%; border-collapse: collapse; margin-top: 10px; background-color: #FFFFFF; }
        #ai-analyzer-panel th, #ai-analyzer-panel td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; word-break: break-all; }
        #ai-analyzer-panel th { background-color: #f2f2f2; font-weight: bold; }
        .link-follow-indicator { position: fixed; background-color: rgba(0, 0, 0, 0.75); color: white; padding: 2px 5px; border-radius: 3px; font-size: 12px; z-index: 10001; pointer-events: none; opacity: 0; transform: translateY(10px); animation: dofollow-fade-in-up 0.4s ease-out forwards; }
        @keyframes dofollow-fade-in-up { to { opacity: 1; transform: translateY(0); } }

        /* 新增: 表单样式 */
        #link-submission-form h4 { text-align: center; margin-top: 0; margin-bottom: 15px; color: #333; }
        .form-url-display { font-size: 12px; color: #666; word-break: break-all; background: #eee; padding: 5px; border-radius: 3px; margin-bottom: 10px; text-align: center; }
        .form-group { margin-bottom: 12px; display: flex; align-items: center; }
        .form-group label { flex: 0 0 100px; font-size: 14px; }
        .form-input { flex-grow: 1; width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .form-checkbox-group { display: flex; align-items: center; margin-bottom: 12px; }
        .form-checkbox-group label { margin-left: 8px; user-select: none; }
        .form-actions { display: flex; justify-content: space-between; margin-top: 20px; }
        .form-actions button { width: 48%; padding: 10px; border-radius: 5px; border: none; color: white; font-size: 15px; cursor: pointer; }
        #submit-link-btn { background-color: #007bff; }
        #cancel-submission-btn { background-color: #6c757d; }
    `);

    // --- 创建UI元素 ---
    const panel = document.createElement('div');
    panel.id = 'ai-analyzer-panel';
    const toggleButton = document.createElement('button');
    toggleButton.id = 'ai-analyzer-toggle-btn';
    toggleButton.textContent = '0';
    document.body.appendChild(toggleButton);

    panel.innerHTML = `
        <div class="ai-analyzer-header">
            <div class="header-left">
                 <h3>页面分析助手</h3>
                 <span id="external-link-counter" title="页面Dofollow外链数量"></span>
                 <span id="dofollow-nav-controls" style="display: none;">
                    <span id="dofollow-nav-up" class="dofollow-nav-arrow" title="上一个Dofollow链接">▲</span>
                    <span id="dofollow-nav-down" class="dofollow-nav-arrow" title="下一个Dofollow链接">▼</span>
                 </span>
            </div>
            <span id="ai-settings-btn" title="设置">⚙️</span>
        </div>
        <div class="ai-analyzer-body" id="ai-analyzer-results"></div>
        <div id="ai-settings-area">
            <div>
                <label for="gemini-api-key-input">Gemini API Key:</label>
                <input type="password" id="gemini-api-key-input" placeholder="用于AI分析的Gemini sk-密钥">
                <button id="save-gemini-key-btn" class="settings-btn">保存Gemini Key</button>
            </div>
            <hr style="margin: 15px 0; border: 0; border-top: 1px solid #ccc;">
            <div>
                <label for="api-token-input">External Link API Token:</label>
                <input type="password" id="api-token-input" placeholder="用于提交外链的Token">
                <button id="save-api-token-btn" class="settings-btn">保存Token</button>
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    const resultsDiv = document.getElementById('ai-analyzer-results');
    const settingsBtn = document.getElementById('ai-settings-btn');
    const settingsArea = document.getElementById('ai-settings-area');
    const geminiApiKeyInput = document.getElementById('gemini-api-key-input');
    const apiTokenInput = document.getElementById('api-token-input');
    const saveGeminiKeyBtn = document.getElementById('save-gemini-key-btn');
    const saveApiTokenBtn = document.getElementById('save-api-token-btn');
    let currentIndicator = null;

    // --- 功能函数 ---

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
        document.getElementById('external-link-counter').textContent = `(Dofollow: ${dofollowCount})`;
        toggleButton.textContent = dofollowCount;
        document.getElementById('dofollow-nav-controls').style.display = dofollowCount > 0 ? 'inline-block' : 'none';
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

    // --- 新增：提交链接表单 ---
    async function displaySubmissionForm() {
        if (!apiToken) {
            resultsDiv.innerHTML = `<p class="error-message">请先在设置中填写 'External Link API Token'!</p>`;
            settingsArea.style.display = 'block';
            document.getElementById('api-token-input').focus();
            return;
        }

        resultsDiv.innerHTML = `
            <form id="link-submission-form" novalidate>
                <h4>提交当前页面链接</h4>
                <p class="form-url-display">URL: ${window.location.href}</p>
                <div class="form-group">
                    <label for="form-as">AS:</label>
                    <input type="number" id="form-as" class="form-input" value="0" min="0">
                </div>
                <div class="form-group">
                    <label for="form-dr">DR:</label>
                    <input type="number" id="form-dr" class="form-input" value="0" min="0">
                </div>
                <div class="form-checkbox-group">
                    <input type="checkbox" id="form-need-login">
                    <label for="form-need-login">需要登录 (Need Login)</label>
                </div>
                <div class="form-checkbox-group">
                    <input type="checkbox" id="form-has-capture">
                    <label for="form-has-capture">有验证码 (Has Capture)</label>
                </div>
                <div class="form-group">
                    <label for="form-capture-type">验证码类型:</label>
                    <input type="text" id="form-capture-type" class="form-input" placeholder="例如: reCAPTCHA">
                </div>
                <div class="form-group">
                    <label for="form-remarks">备注:</label>
                    <textarea id="form-remarks" class="form-input" rows="3" maxlength="2000"></textarea>
                </div>
                <div class="form-actions">
                     <button type="submit" id="submit-link-btn">确认提交</button>
                     <button type="button" id="cancel-submission-btn">取消</button>
                </div>
                <div id="submission-status"></div>
            </form>
        `;

        document.getElementById('link-submission-form').addEventListener('submit', handleFormSubmission);
        document.getElementById('cancel-submission-btn').addEventListener('click', setInitialState);
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
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    statusDiv.className = 'status-message success-message';
                    statusDiv.textContent = '提交成功!';
                    setTimeout(setInitialState, 2000);
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


    // --- 核心逻辑 ---
    async function initialize() {
        geminiApiKey = await GM_getValue('GEMINI_API_KEY', null);
        apiToken = await GM_getValue('API_TOKEN', null);
        geminiApiKeyInput.value = geminiApiKey || '';
        apiTokenInput.value = apiToken || '';

        setInitialState();
        setupEventListeners();
        setupLinkHoverIndicator();

        setTimeout(() => {
            scanAndPrepareDofollowLinks();
            setupIntersectionObserverForLinks();
        }, 1000);
    }

    function setInitialState() {
        resultsDiv.innerHTML = `
             <button id="run-analysis-btn" class="action-btn">手动分析当前页面</button>
             <button id="show-submission-form-btn" class="action-btn">提交当前链接</button>
        `;
        document.getElementById('run-analysis-btn').addEventListener('click', () => {
            document.getElementById('run-analysis-btn').style.display = 'none';
            document.getElementById('show-submission-form-btn').style.display = 'none';
            runAnalysis();
        });
        document.getElementById('show-submission-form-btn').addEventListener('click', displaySubmissionForm);
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
            saveGeminiKeyBtn.textContent = '已保存!';
            setTimeout(() => { saveGeminiKeyBtn.textContent = '保存Gemini Key'; }, 2000);
        });

        saveApiTokenBtn.addEventListener('click', async () => {
            const newToken = apiTokenInput.value.trim();
            await GM_setValue('API_TOKEN', newToken);
            apiToken = newToken;
            saveApiTokenBtn.textContent = '已保存!';
            setTimeout(() => { saveApiTokenBtn.textContent = '保存Token'; }, 2000);
        });

        document.getElementById('dofollow-nav-up').addEventListener('click', () => navigateToDofollowLink('prev'));
        document.getElementById('dofollow-nav-down').addEventListener('click', () => navigateToDofollowLink('next'));
    }

    async function runAnalysis() {
        if (!geminiApiKey) {
            resultsDiv.innerHTML = `<p class="error-message">请先设置您的Gemini API Key!</p>`;
            settingsArea.style.display = 'block';
            geminiApiKeyInput.focus();
            return;
        }

        resultsDiv.innerHTML = '<p class="status-message">正在扫描页面Dofollow外链...</p>';
        scanAndPrepareDofollowLinks();
        const dofollowCount = dofollowLinks.length;

        if (dofollowCount <= DOFOLLOW_THRESHOLD) {
            resultsDiv.innerHTML = `<p class="status-message">分析终止：页面Dofollow外链数量为 ${dofollowCount}，未超过 ${DOFOLLOW_THRESHOLD} 个的阈值。</p>`;
            const resetButton = document.createElement('button');
            resetButton.textContent = '重新开始';
            resetButton.className = 'action-btn';
            resetButton.style.backgroundColor = '#6c757d';
            resetButton.style.marginTop = '10px';
            resetButton.onclick = setInitialState;
            resultsDiv.appendChild(resetButton);
            return;
        }

        resultsDiv.innerHTML = `<p class="status-message">检测到 ${dofollowCount} 个Dofollow外链，正在请求AI分析页面...</p>`;
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
                        resultsDiv.innerHTML = `<p class="error-message">API返回错误:<br>代码: ${code}<br>消息: ${message}</p>`;
                        return;
                    }
                    const responseText = aiRawData.candidates[0].content.parts[0].text;
                    const aiJson = JSON.parse(responseText.replace(/^```json\s*|```\s*$/g, '').trim());
                    displayResultsTable(aiJson, hasDofollow);
                } catch (error) {
                    console.error("AI Response Parsing Error:", error, "Raw Response:", response.responseText);
                    resultsDiv.innerHTML = `<p class="error-message">AI分析失败！<br>理由: 无法解析AI返回的数据。<br>请检查控制台获取更多信息。</p>`;
                }
            },
            onerror: function(error) {
                console.error("GM_xmlhttpRequest Error:", error);
                resultsDiv.innerHTML = `<p class="error-message">AI分析失败！<br>理由: 请求未能送达至您的服务器 (${CUSTOM_BASE_URL})。<br>请检查服务器运行状态和浏览器控制台。</p>`;
            }
        });
    }

    function displayResultsTable(aiData, hasDofollow) {
        const tableHTML = `
            <table id="ai-results-table">
                <thead><tr><th>URL</th><th>是否需登录</th><th>有Dofollow</th><th>有验证</th><th>验证类型</th><th>备注</th></tr></thead>
                <tbody><tr>
                    <td>${window.location.href}</td>
                    <td>${aiData.requiresLogin ? '是' : '否'}</td>
                    <td>${hasDofollow ? '是' : '否'}</td>
                    <td>${aiData.hasVerification ? '是' : '否'}</td>
                    <td>${aiData.verificationType || '无'}</td>
                    <td>${aiData.pageType || 'N/A'}</td>
                </tr></tbody>
            </table>
            <button id="copy-table-btn">复制表格</button>
            <button id="restart-btn" style="float: left; margin-top: 15px; background-color: #6c757d; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">返回主页</button>
        `;
        resultsDiv.innerHTML = tableHTML;
        document.getElementById('copy-table-btn').addEventListener('click', copyTableToClipboard);
        document.getElementById('restart-btn').addEventListener('click', setInitialState);
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

    // --- 脚本启动 ---
    initialize();

})();