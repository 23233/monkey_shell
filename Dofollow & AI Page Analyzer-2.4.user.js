// ==UserScript==
// @name         SEO页面内容分析器
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  分析Dofollow外链, AI分析页面内容, 支持链接跳转导航.
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
    const MODEL_NAME = "gemini-2.5-pro";
    const DOFOLLOW_THRESHOLD = 5;
    let apiKey = null;
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
            position: fixed; bottom: 80px; right: 20px; width: 450px; max-height: 500px;
            background-color: #f9f9f9; border: 1px solid #ccc; border-radius: 8px;
            z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none;
            flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .ai-analyzer-header {
            padding: 10px 15px; background-color: #f1f1f1; border-bottom: 1px solid #ddd;
            display: flex; justify-content: space-between; align-items: center;
        }
        .header-left { display: flex; align-items: center; }
        .ai-analyzer-header h3 { margin: 0; font-size: 16px; color: #333; }
        #external-link-counter {
            font-size: 14px;
            color: #555;
            margin-left: 10px;
            font-weight: normal;
        }
        /* --- 新增：导航箭头样式 --- */
        #dofollow-nav-controls {
            margin-left: 8px;
            display: inline-block; /* 默认不显示, JS控制 */
        }
        .dofollow-nav-arrow {
            font-size: 16px;
            cursor: pointer;
            user-select: none;
            padding: 0 4px;
            color: #333;
            font-weight: bold;
        }
        .dofollow-nav-arrow:hover {
            color: #007bff;
        }
        /* --- 新增：链接高亮样式 --- */
        .highlighted-dofollow-link {
            outline: 3px solid #007bff !important;
            box-shadow: 0 0 15px rgba(0, 123, 255, 0.7) !important;
            border-radius: 3px;
            transition: outline 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
        }

        .ai-analyzer-body { padding: 15px; overflow-y: auto; color: #333; }
        #ai-settings-btn { font-size: 20px; cursor: pointer; user-select: none; }
        #ai-settings-area { display: none; padding: 10px; margin-top: 10px; background-color: #e9ecef; border-radius: 4px; }
        #api-key-input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 8px; }
        .settings-btn { width: 100%; padding: 8px; border-radius: 4px; border: none; color: white; cursor: pointer; }
        #save-api-key-btn { background-color: #28a745; }
        #run-analysis-btn { width: 100%; padding: 12px; font-size: 16px; font-weight: bold; cursor: pointer; background-color: #28a745; color: white; border: none; border-radius: 5px; }
        #copy-table-btn { background-color: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-top: 15px; float: right; }
        .status-message { font-style: italic; color: #666; }
        .error-message { color: #d9534f; font-weight: bold; white-space: pre-wrap; word-wrap: break-word; }
        #ai-analyzer-panel table { width: 100%; border-collapse: collapse; margin-top: 10px; background-color: #FFFFFF; color: #333333; }
        #ai-analyzer-panel th, #ai-analyzer-panel td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; word-break: break-all; }
        #ai-analyzer-panel th { background-color: #f2f2f2; color: #000000; font-weight: bold; }
        #ai-analyzer-panel td { background-color: #FFFFFF; color: #333333; }
        .link-follow-indicator { position: fixed; background-color: rgba(0, 0, 0, 0.75); color: white; padding: 2px 5px; border-radius: 3px; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; z-index: 10001; pointer-events: none; opacity: 0; transform: translateY(10px); animation: dofollow-fade-in-up 0.4s ease-out forwards; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        @keyframes dofollow-fade-in-up { to { opacity: 1; transform: translateY(0); } }
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
                 <!-- 新增: 导航箭头容器 -->
                 <span id="dofollow-nav-controls" style="display: none;">
                    <span id="dofollow-nav-up" class="dofollow-nav-arrow" title="上一个Dofollow链接">▲</span>
                    <span id="dofollow-nav-down" class="dofollow-nav-arrow" title="下一个Dofollow链接">▼</span>
                 </span>
            </div>
            <span id="ai-settings-btn" title="设置API Key">⚙️</span>
        </div>
        <div class="ai-analyzer-body" id="ai-analyzer-results"></div>
        <div id="ai-settings-area">
            <label for="api-key-input">Gemini API Key:</label>
            <input type="password" id="api-key-input" placeholder="请在此处粘贴您的sk-开头的密钥">
            <button id="save-api-key-btn" class="settings-btn">保存密钥</button>
        </div>
    `;
    document.body.appendChild(panel);

    const resultsDiv = document.getElementById('ai-analyzer-results');
    const settingsBtn = document.getElementById('ai-settings-btn');
    const settingsArea = document.getElementById('ai-settings-area');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    let currentIndicator = null;

    // --- 功能函数 ---

    /**
     * [修改] 扫描、计数并存储Dofollow外链，同时控制导航箭头的可见性。
     */
    function scanAndPrepareDofollowLinks() {
        // 重置状态
        dofollowLinks = [];
        currentLinkIndex = -1;

        const currentHostname = window.location.hostname;
        document.querySelectorAll('a[href]').forEach(link => {
            try {
                if (!link.href || !link.offsetParent) return; // 忽略不可见的链接
                const linkUrl = new URL(link.href, window.location.href);
                const linkHostname = linkUrl.hostname;

                if (linkHostname && linkHostname !== currentHostname) {
                    const rel = link.getAttribute('rel') || '';
                    if (!rel.toLowerCase().includes('nofollow')) {
                        dofollowLinks.push(link); // 存储链接元素
                    }
                }
            } catch (e) { /* 忽略无效URL */ }
        });

        const dofollowCount = dofollowLinks.length;

        // 更新面板计数器
        const panelCounterElement = document.getElementById('external-link-counter');
        if (panelCounterElement) {
            panelCounterElement.textContent = `(Dofollow: ${dofollowCount})`;
        }

        // 更新右下角浮动按钮
        const toggleButtonElem = document.getElementById('ai-analyzer-toggle-btn');
        if (toggleButtonElem) {
            toggleButtonElem.textContent = dofollowCount;
        }

        // 根据链接数量决定是否显示导航箭头
        const navControls = document.getElementById('dofollow-nav-controls');
        if (navControls) {
            navControls.style.display = dofollowCount > 0 ? 'inline-block' : 'none';
        }
    }

    /**
     * [新增] 导航到指定方向的Dofollow链接
     * @param {'prev' | 'next'} direction - 导航方向
     */
    function navigateToDofollowLink(direction) {
        if (dofollowLinks.length === 0) return;

        // 移除上一个链接的高亮
        const previousLink = dofollowLinks[currentLinkIndex];
        if (previousLink) {
            previousLink.classList.remove('highlighted-dofollow-link');
        }

        // 计算下一个索引
        if (direction === 'next') {
            currentLinkIndex++;
            if (currentLinkIndex >= dofollowLinks.length) {
                currentLinkIndex = 0; // 循环到第一个
            }
        } else { // prev
            currentLinkIndex--;
            if (currentLinkIndex < 0) {
                currentLinkIndex = dofollowLinks.length - 1; // 循环到最后一个
            }
        }

        // 滚动到新链接并高亮
        const targetLink = dofollowLinks[currentLinkIndex];
        if (targetLink) {
            // 滚动到视图中央
            targetLink.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // 添加高亮效果，2秒后自动移除
            targetLink.classList.add('highlighted-dofollow-link');
            setTimeout(() => {
                targetLink.classList.remove('highlighted-dofollow-link');
            }, 2000);
        }
    }


    /**
     * 为指定的链接元素显示一个指示器。
     */
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
        if (left < window.scrollX + 5) { left = window.scrollX + 5; }
        if (left + indicatorRect.width > window.innerWidth + window.scrollX) { left = window.innerWidth + window.scrollX - indicatorRect.width - 5; }
        indicator.style.top = `${top}px`;
        indicator.style.left = `${left}px`;
        setTimeout(() => { indicator.remove(); }, duration);
        return indicator;
    }

    /**
     * 使用IntersectionObserver来监控所有外链。
     */
    function setupIntersectionObserverForLinks() {
        const currentHostname = window.location.hostname;
        const observerCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const link = entry.target;
                    showIndicatorForLink(link, 800);
                    observer.unobserve(link);
                }
            });
        };
        const observerOptions = { root: null, rootMargin: '0px', threshold: 0.1 };
        const linkObserver = new IntersectionObserver(observerCallback, observerOptions);
        document.querySelectorAll('a[href]').forEach(link => {
            try {
                const linkHostname = new URL(link.href).hostname;
                if (linkHostname && linkHostname !== currentHostname) {
                    linkObserver.observe(link);
                }
            } catch (e) { /* 忽略无效URL */ }
        });
    }


    /**
     * 为所有外链设置鼠标悬停时的指示器。
     */
    function setupLinkHoverIndicator() {
        const currentHostname = window.location.hostname;
        document.body.addEventListener('mouseover', event => {
            const link = event.target.closest('a');
            if (!link || !link.href) return;
            try {
                const linkHostname = new URL(link.href).hostname;
                if (!linkHostname || linkHostname === currentHostname) return;
            } catch (e) { return; }
            if (currentIndicator) {
                clearTimeout(currentIndicator.timeoutId);
                currentIndicator.remove();
            }
            const indicator = showIndicatorForLink(link, 600);
            currentIndicator = indicator;
            indicator.timeoutId = setTimeout(() => {
                if (currentIndicator === indicator) {
                    currentIndicator = null;
                }
            }, 600);
        });
    }

    // --- 核心逻辑 ---
    async function initialize() {
        apiKey = await GM_getValue('GEMINI_API_KEY', null);
        apiKeyInput.value = apiKey || '';
        setInitialState();
        setupEventListeners();
        setupLinkHoverIndicator();

        setTimeout(() => {
            scanAndPrepareDofollowLinks(); // [修改] 调用新函数
            setupIntersectionObserverForLinks();
        }, 1000);
    }

    function setInitialState() {
        resultsDiv.innerHTML = '<button id="run-analysis-btn">手动分析当前页面</button>';
        const runBtn = document.getElementById('run-analysis-btn');
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                runBtn.style.display = 'none';
                runAnalysis();
            });
        }
    }

    function setupEventListeners() {
        toggleButton.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
        });

        settingsBtn.addEventListener('click', () => {
            settingsArea.style.display = settingsArea.style.display === 'block' ? 'none' : 'block';
        });

        saveApiKeyBtn.addEventListener('click', async () => {
            const newKey = apiKeyInput.value.trim();
            if (newKey) {
                await GM_setValue('GEMINI_API_KEY', newKey);
                apiKey = newKey;
                saveApiKeyBtn.textContent = '已保存!';
                settingsArea.style.display = 'none';
                resultsDiv.innerHTML = `<p class="status-message">API Key已保存，正在继续分析...</p>`;
                setTimeout(runAnalysis, 500);
                setTimeout(() => { saveApiKeyBtn.textContent = '保存密钥'; }, 2000);
            } else {
                alert('API Key不能为空！');
            }
        });

        // [新增] 为导航箭头绑定点击事件
        const navUp = document.getElementById('dofollow-nav-up');
        const navDown = document.getElementById('dofollow-nav-down');
        if (navUp) navUp.addEventListener('click', () => navigateToDofollowLink('prev'));
        if (navDown) navDown.addEventListener('click', () => navigateToDofollowLink('next'));
    }

    async function runAnalysis() {
        if (!apiKey) {
            resultsDiv.innerHTML = `<p class="error-message">请先设置您的API Key!</p>`;
            settingsArea.style.display = 'block';
            apiKeyInput.focus();
            return;
        }

        resultsDiv.innerHTML = '<p class="status-message">正在扫描页面Dofollow外链...</p>';
        scanAndPrepareDofollowLinks(); // 再次扫描以确保数据最新
        const dofollowCount = dofollowLinks.length;

        if (dofollowCount <= DOFOLLOW_THRESHOLD) {
            const reason = `分析终止：页面Dofollow外链数量为 ${dofollowCount}，未超过 ${DOFOLLOW_THRESHOLD} 个的阈值。`;
            resultsDiv.innerHTML = `<p class="status-message">${reason}</p>`;
            const resetButton = document.createElement('button');
            resetButton.textContent = '重新分析';
            resetButton.id = 'run-analysis-btn';
            resetButton.style.marginTop = '10px';
            resetButton.onclick = () => {
                resetButton.style.display = 'none';
                runAnalysis();
            };
            resultsDiv.appendChild(resetButton);
            return;
        }

        resultsDiv.innerHTML = `<p class="status-message">检测到 ${dofollowCount} 个Dofollow外链，正在请求AI分析页面...</p>`;
        callAiApi(dofollowCount > 0, apiKey);
    }

    // --- API调用逻辑 (无变化) ---
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
            - **hasVerification**: true if any captcha, security check, or human verification (e.g., reCAPTCHA, hCaptcha, image captcha, math puzzle, simple checkbox, SMS verification) is clearly visible or implied for primary actions (e.g., submitting a form, commenting, registration); otherwise false.
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
                        console.error("AI API Error:", aiRawData.error);
                        const errorMessage = `API返回错误:\n代码: ${aiRawData.error.code}\n消息: ${aiRawData.error.message}`;
                        resultsDiv.innerHTML = `<p class="error-message">${errorMessage}</p>`;
                        return;
                    }
                    const responseText = aiRawData.candidates[0].content.parts[0].text;
                    const aiJson = JSON.parse(responseText.replace(/^```json\s*|```\s*$/g, '').trim());
                    aiJson.hasVerification = typeof aiJson.hasVerification === 'boolean' ? aiJson.hasVerification : false;
                    aiJson.verificationType = aiJson.verificationType || '无';
                    displayResultsTable(aiJson, hasDofollow);
                } catch (error) {
                    console.error("AI Response Parsing Error:", error, "Raw Response:", response.responseText);
                    resultsDiv.innerHTML = `<p class="error-message">AI分析失败！<br>理由: 无法解析AI返回的数据。<br>请检查控制台获取更多信息。</p>`;
                }
            },
            onerror: function(error) {
                console.error("GM_xmlhttpRequest Error:", error);
                resultsDiv.innerHTML = `<p class="error-message">AI分析失败！<br>理由: 请求未能送达至您的服务器 (${CUSTOM_BASE_URL})。<br>请确保服务器正在运行且可访问，并检查浏览器控制台的网络错误。</p>`;
            }
        });
    }

    // --- 结果展示和复制功能 (无变化) ---
    function displayResultsTable(aiData, hasDofollow) {
        const tableHTML = `
            <table id="ai-results-table">
                <thead>
                    <tr>
                        <th>URL</th>
                        <th>是否需要登录</th>
                        <th>是否有Dofollow外链</th>
                        <th>是否有验证</th>
                        <th>验证类型</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${window.location.href}</td>
                        <td>${aiData.requiresLogin ? '是' : '否'}</td>
                        <td>${hasDofollow ? '是' : '否'}</td>
                        <td>${aiData.hasVerification ? '是' : '否'}</td>
                        <td>${aiData.verificationType || '无'}</td>
                        <td>${aiData.pageType || 'N/A'}</td>
                    </tr>
                </tbody>
            </table>
            <button id="copy-table-btn">复制表格</button>
        `;
        resultsDiv.innerHTML = tableHTML;
        document.getElementById('copy-table-btn').addEventListener('click', copyTableToClipboard);
    }

    function copyTableToClipboard() {
        const table = document.getElementById('ai-results-table');
        if (!table) return;
        let text = '';
        table.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('th, td');
            text += Array.from(cells).map(cell => `"${cell.innerText.replace(/"/g, '""')}"`).join('\t') + '\n';
        });
        GM_setClipboard(text.trim());
        alert('表格内容已复制到剪贴板！');
    }

    // --- 脚本启动 ---
    initialize();

})();