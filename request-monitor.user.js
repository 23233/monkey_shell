// ==UserScript==
// @name         通用接口请求监控器
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  监控并记录网页请求，支持筛选、分组和可视化查看
// @author       23233
// @match        *://*/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 存储请求记录
    const requestStore = {
        requests: [],
        filteredRequests: [],
        filterText: '',
        groupBy: 'none', // 'none', 'domain', 'prefix'
        prefixDepth: 1,   // 路径前缀深度
        activeTag: null,  // 当前激活的标签
        focusTags: GM_getValue('focusTags', []), // 重点关注的标签列表
        
        // 添加请求
        addRequest(request) {
            // 生成请求的标签
            request.tags = this.generateTags(request.url);
            this.requests.push(request);
            this.applyFilters();
        },
        
        // 生成URL的标签
        generateTags(url) {
            try {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/').filter(p => p);
                
                const tags = [];
                let currentPath = '';
                
                for (const part of pathParts) {
                    currentPath += '/' + part;
                    tags.push(currentPath);
                }
                
                return tags;
            } catch (e) {
                return [];
            }
        },
        
        // 应用筛选条件
        applyFilters() {
            let filtered = [...this.requests];
            
            // 应用文本筛选
            if (this.filterText) {
                const lowerFilter = this.filterText.toLowerCase();
                filtered = filtered.filter(req => 
                    req.url.toLowerCase().includes(lowerFilter) || 
                    (req.responseText && req.responseText.toLowerCase().includes(lowerFilter))
                );
            }
            
            // 应用标签筛选
            if (this.activeTag) {
                filtered = filtered.filter(req => req.tags.includes(this.activeTag));
            }
            
            this.filteredRequests = filtered;
            
            // 通知UI更新
            uiManager.updateRequestList();
        },
        
        // 设置筛选文本
        setFilter(text) {
            this.filterText = text;
            this.applyFilters();
        },
        
        // 设置或切换活动标签
        toggleTag(tag) {
            if (this.activeTag === tag) {
                // 如果点击的是当前活动标签，则取消选择
                this.activeTag = null;
            } else {
                // 否则设置为新的活动标签
                this.activeTag = tag;
            }
            this.applyFilters();
        },
        
        // 设置分组方式
        setGroupBy(groupBy, depth = 1) {
            this.groupBy = groupBy;
            this.prefixDepth = depth;
            uiManager.updateRequestList();
        },
        
        // 获取分组数据
        getGroupedRequests() {
            if (this.groupBy === 'none') {
                return { 'All Requests': this.filteredRequests };
            }
            
            const groups = {};
            
            this.filteredRequests.forEach(req => {
                let groupKey;
                
                if (this.groupBy === 'domain') {
                    const url = new URL(req.url);
                    groupKey = url.hostname;
                } else if (this.groupBy === 'prefix') {
                    const url = new URL(req.url);
                    const pathParts = url.pathname.split('/').filter(p => p);
                    const prefixParts = [url.hostname, ...pathParts.slice(0, this.prefixDepth)];
                    groupKey = prefixParts.join('/');
                }
                
                if (!groups[groupKey]) {
                    groups[groupKey] = [];
                }
                
                groups[groupKey].push(req);
            });
            
            return groups;
        },
        
        // 清除所有筛选条件
        clearFilters() {
            this.filterText = '';
            this.activeTag = null;
            this.applyFilters();
        },
        
        // 添加重点关注标签
        addFocusTag(tag, urlPattern) {
            this.focusTags.push({
                tag: tag,
                urlPattern: urlPattern
            });
            GM_setValue('focusTags', this.focusTags);
        },
        
        // 删除重点关注标签
        removeFocusTag(index) {
            this.focusTags.splice(index, 1);
            GM_setValue('focusTags', this.focusTags);
        },
        
        // 获取当前页面匹配的重点关注标签
        getMatchingFocusTags() {
            const currentUrl = window.location.href;
            return this.focusTags.filter(item => {
                // 将 urlPattern 转换为正则表达式
                // 替换 * 为 .*
                const pattern = item.urlPattern.replace(/\*/g, '.*');
                const regex = new RegExp(pattern);
                return regex.test(currentUrl);
            });
        }
    };

    // UI管理器
    const uiManager = {
        panel: null,
        requestList: null,
        detailView: null,
        isVisible: false,
        
        // 初始化UI
        init() {
            this.createStyles();
            this.createPanel();
            this.createToggleButton();
        },
        
        // 创建样式
        createStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .rm-container * {
                    box-sizing: border-box;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }
                
                .rm-toggle-btn-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                }
                
                .rm-toggle-btn-tab {
                    display: none;
                }
                
                .rm-toggle-btn {
                    background-color: #4a6cf7;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    width: 18px;
                    height: 18px;
                    font-size: 12px;
                    cursor: pointer;
                    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background-color 0.3s;
                }
                
                .rm-toggle-btn:hover {
                    background-color: #3a5ce5;
                }
                
                .rm-panel {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 80%;
                    height: 100%;
                    background-color: #f8f9fa;
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
                    transition: transform 0.3s ease;
                    transform: translateX(-100%);
                }
                
                .rm-panel.rm-visible {
                    transform: translateX(0);
                }
                
                .rm-header {
                    padding: 15px;
                    background-color: #4a6cf7;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .rm-title {
                    font-size: 18px;
                    font-weight: bold;
                    margin: 0;
                }
                
                .rm-close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                }
                
                .rm-toolbar {
                    padding: 10px 15px;
                    background-color: #e9ecef;
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    align-items: center;
                }
                
                .rm-search {
                    flex: 1;
                    min-width: 200px;
                    padding: 8px 12px;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    font-size: 14px;
                }
                
                .rm-select {
                    padding: 8px 12px;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                    font-size: 14px;
                    background-color: white;
                }
                
                .rm-button {
                    padding: 8px 12px;
                    background-color: #4a6cf7;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .rm-button:hover {
                    background-color: #3a5ce5;
                }
                
                .rm-content {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }
                
                .rm-request-list {
                    width: 40%;
                    overflow-y: auto;
                    border-right: 1px solid #dee2e6;
                    background-color: white;
                }
                
                .rm-group-header {
                    padding: 10px 15px;
                    background-color: #e9ecef;
                    font-weight: bold;
                    border-bottom: 1px solid #dee2e6;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .rm-group-header:hover {
                    background-color: #dee2e6;
                }
                
                .rm-group-count {
                    background-color: #4a6cf7;
                    color: white;
                    border-radius: 10px;
                    padding: 2px 8px;
                    font-size: 12px;
                }
                
                .rm-group-content {
                    display: none;
                }
                
                .rm-group-content.rm-expanded {
                    display: block;
                }
                
                .rm-request-item {
                    padding: 10px 15px;
                    border-bottom: 1px solid #dee2e6;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .rm-request-item:hover {
                    background-color: #f1f3f5;
                }
                
                .rm-request-item.rm-selected {
                    background-color: #e7f5ff;
                    border-left: 4px solid #4a6cf7;
                }
                
                .rm-request-method {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-right: 8px;
                }
                
                .rm-method-get {
                    background-color: #d1ecf1;
                    color: #0c5460;
                }
                
                .rm-method-post {
                    background-color: #d4edda;
                    color: #155724;
                }
                
                .rm-method-put {
                    background-color: #fff3cd;
                    color: #856404;
                }
                
                .rm-method-delete {
                    background-color: #f8d7da;
                    color: #721c24;
                }
                
                .rm-request-url {
                    font-size: 13px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 5px;
                }
                
                .rm-request-time {
                    font-size: 12px;
                    color: #6c757d;
                }
                
                .rm-detail-view {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    background-color: white;
                }
                
                .rm-detail-header {
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #dee2e6;
                }
                
                .rm-detail-url {
                    font-size: 16px;
                    word-break: break-all;
                    margin-bottom: 10px;
                }
                
                .rm-detail-info {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    font-size: 14px;
                    color: #495057;
                }
                
                .rm-detail-section {
                    margin-bottom: 20px;
                }
                
                .rm-detail-section-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    padding-bottom: 5px;
                    border-bottom: 1px solid #dee2e6;
                }
                
                .rm-tabs {
                    display: flex;
                    border-bottom: 1px solid #dee2e6;
                    margin-bottom: 15px;
                }
                
                .rm-tab {
                    padding: 8px 15px;
                    cursor: pointer;
                    border: 1px solid transparent;
                    border-bottom: none;
                    border-radius: 4px 4px 0 0;
                    margin-right: 5px;
                    background-color: #f8f9fa;
                }
                
                .rm-tab:hover {
                    background-color: #e9ecef;
                }
                
                .rm-tab.rm-active {
                    background-color: white;
                    border-color: #dee2e6;
                    margin-bottom: -1px;
                }
                
                .rm-tab-content {
                    display: none;
                }
                
                .rm-tab-content.rm-active {
                    display: block;
                }
                
                .rm-code {
                    background-color: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    padding: 15px;
                    overflow: auto;
                    font-family: monospace;
                    white-space: pre-wrap;
                    max-height: 500px;
                }
                
                .rm-json-viewer {
                    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
                    line-height: 1.5;
                    font-size: 13px;
                    background-color: #f8f9fa;
                    border-radius: 4px;
                    padding: 12px;
                    overflow: auto;
                    max-height: 600px;
                }
                
                .rm-json-item {
                    margin: 2px 0;
                }
                
                .rm-json-key {
                    color: #d63384;
                    font-weight: 500;
                }
                
                .rm-json-string {
                    color: #198754;
                }
                
                .rm-json-number {
                    color: #0d6efd;
                }
                
                .rm-json-boolean {
                    color: #dc3545;
                    font-weight: 500;
                }
                
                .rm-json-null {
                    color: #6c757d;
                    font-style: italic;
                }
                
                .rm-json-bracket {
                    color: #212529;
                    font-weight: bold;
                }
                
                .rm-json-preview {
                    color: #6c757d;
                    font-style: italic;
                    margin-left: 5px;
                    font-size: 12px;
                }
                
                .rm-json-array-index {
                    color: #6c757d;
                    margin-right: 8px;
                    user-select: none;
                    min-width: 20px;
                    display: inline-block;
                    text-align: right;
                }
                
                .rm-json-array-item, .rm-json-property {
                    padding: 2px 0;
                    position: relative;
                    border-left: 1px dotted #dee2e6;
                    margin-left: 5px;
                    display: flex;
                    flex-wrap: wrap;
                    align-items: baseline;
                }
                
                .rm-json-array-item:hover, .rm-json-property:hover {
                    background-color: rgba(0,0,0,0.03);
                }
                
                .rm-json-colon {
                    color: #212529;
                    margin-right: 5px;
                }
                
                .rm-json-comma {
                    color: #212529;
                    margin-left: 2px;
                }
                
                .rm-json-object-header, .rm-json-array-header {
                    cursor: pointer;
                    user-select: none;
                    display: flex;
                    align-items: center;
                }
                
                .rm-json-object-header:before, .rm-json-array-header:before {
                    content: '▶';
                    display: inline-block;
                    transform: rotate(90deg);
                    transition: transform 0.2s;
                    margin-right: 5px;
                    color: #6c757d;
                    font-size: 10px;
                }
                
                .rm-json-object-header.rm-collapsed:before, .rm-json-array-header.rm-collapsed:before {
                    transform: rotate(0deg);
                }
                
                .rm-json-object-footer, .rm-json-array-footer {
                    padding-left: 20px;
                }
                
                .rm-collapsible-content {
                    display: none;
                    transition: height 0.3s;
                }
                
                .rm-collapsible-content.rm-expanded {
                    display: block;
                }
                
                .rm-json-copy-btn {
                    background-color: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 2px 6px;
                    font-size: 11px;
                    cursor: pointer;
                    margin-left: 8px;
                    opacity: 0.7;
                    z-index: 1;
                }
                
                .rm-json-copy-btn:hover {
                    opacity: 1;
                }
                
                .rm-json-object:hover > .rm-json-object-header .rm-json-copy-btn,
                .rm-json-array:hover > .rm-json-array-header .rm-json-copy-btn {
                    display: inline-block;
                }
                
                .rm-json-complex-value {
                    width: 100%;
                    margin-top: 2px;
                }
                
                .rm-json-simple-value {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    word-break: break-word;
                    max-width: 100%;
                }
                
                .rm-json-long-string {
                    word-break: break-word;
                    white-space: pre-wrap;
                    max-width: calc(100% - 60px);
                }
                
                .rm-json-simple-copy-btn {
                    margin-left: 8px;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                
                .rm-json-simple-value:hover .rm-json-simple-copy-btn {
                    opacity: 0.7;
                }
                
                .rm-json-simple-copy-btn:hover {
                    opacity: 1 !important;
                }
                
                .rm-request-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    margin-top: 5px;
                }
                
                .rm-tag {
                    display: inline-block;
                    background-color: #e9ecef;
                    color: #495057;
                    font-size: 11px;
                    padding: 2px 6px;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .rm-tag:hover {
                    background-color: #dee2e6;
                }
                
                .rm-tag.rm-active {
                    background-color: #4a6cf7;
                    color: white;
                }
                
                .rm-active-tag-indicator {
                    display: inline-flex;
                    align-items: center;
                    background-color: #4a6cf7;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    margin-right: 8px;
                }
                
                .rm-active-tag-clear {
                    margin-left: 6px;
                    cursor: pointer;
                    font-weight: bold;
                }
                
                .rm-focus-tags-container {
                    padding: 10px 15px;
                    background-color: #f1f3f5;
                    border-bottom: 1px solid #dee2e6;
                }
                
                .rm-focus-tags-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .rm-focus-tags-header h3 {
                    margin: 0;
                    font-size: 14px;
                    color: #495057;
                }
                
                .rm-focus-tags-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 10px;
                }
                
                .rm-focus-tag-item {
                    display: flex;
                    align-items: center;
                    background-color: #e9ecef;
                    border-radius: 4px;
                    padding: 4px 8px;
                    font-size: 12px;
                }
                
                .rm-focus-tag-text {
                    margin-right: 6px;
                }
                
                .rm-focus-tag-delete {
                    cursor: pointer;
                    color: #6c757d;
                    font-weight: bold;
                }
                
                .rm-focus-tag-delete:hover {
                    color: #dc3545;
                }
                
                .rm-focus-tags-form {
                    background-color: #e9ecef;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                }
                
                .rm-focus-tag-input,
                .rm-focus-url-pattern {
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 8px;
                    border: 1px solid #ced4da;
                    border-radius: 4px;
                }
                
                .rm-focus-form-buttons {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                }
                
                .rm-matching-focus-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 10px;
                }
                
                .rm-matching-focus-tag {
                    background-color: #4a6cf7;
                    color: white;
                    border-radius: 4px;
                    padding: 4px 8px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .rm-matching-focus-tag:hover {
                    background-color: #3a5ce5;
                }
                
                @media (max-width: 768px) {
                    .rm-panel {
                        width: 100%;
                    }
                    
                    .rm-content {
                        flex-direction: column;
                    }
                    
                    .rm-request-list {
                        width: 100%;
                        height: 40%;
                    }
                    
                    .rm-detail-view {
                        height: 60%;
                    }
                }
                
                /* 大型JSON数据处理相关样式 */
                .rm-json-large-container {
                    background-color: white;
                    border-radius: 4px;
                    overflow: hidden;
                }
                
                .rm-json-large-warning {
                    display: flex;
                    padding: 15px;
                    background-color: #fff3cd;
                    border-left: 4px solid #ffc107;
                    margin-bottom: 15px;
                }
                
                .rm-json-large-icon {
                    font-size: 24px;
                    margin-right: 15px;
                }
                
                .rm-json-large-message {
                    flex: 1;
                }
                
                .rm-json-large-message p {
                    margin-top: 0;
                    margin-bottom: 10px;
                    font-weight: 500;
                }
                
                .rm-json-large-options {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .rm-json-loading {
                    padding: 20px;
                    text-align: center;
                    color: #6c757d;
                    font-style: italic;
                }
                
                /* JSON预览样式 */
                .rm-json-preview-container {
                    padding: 15px;
                    background-color: #f8f9fa;
                    border-radius: 4px;
                }
                
                .rm-json-preview-info {
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #dee2e6;
                    font-size: 14px;
                }
                
                .rm-json-preview-type {
                    font-weight: bold;
                    color: #4a6cf7;
                }
                
                .rm-json-preview-count {
                    font-weight: bold;
                }
                
                .rm-json-preview-items {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .rm-json-preview-item {
                    display: flex;
                    align-items: baseline;
                    padding: 5px 10px;
                    background-color: white;
                    border-radius: 4px;
                    border-left: 3px solid #e9ecef;
                }
                
                .rm-json-preview-item:hover {
                    border-left-color: #4a6cf7;
                    background-color: #f1f3f5;
                }
                
                .rm-json-preview-index {
                    color: #6c757d;
                    margin-right: 10px;
                    font-family: monospace;
                }
                
                .rm-json-preview-key {
                    color: #d63384;
                    font-weight: 500;
                    margin-right: 5px;
                }
                
                .rm-json-preview-colon {
                    margin-right: 5px;
                    color: #212529;
                }
                
                .rm-json-preview-more {
                    padding: 10px;
                    text-align: center;
                    color: #6c757d;
                    font-style: italic;
                    background-color: #f1f3f5;
                    border-radius: 4px;
                    margin-top: 5px;
                }
                
                .rm-json-collapsed-preview {
                    color: #6c757d;
                    font-style: italic;
                    cursor: pointer;
                }
                
                .rm-json-collapsed-preview:hover {
                    text-decoration: underline;
                    color: #4a6cf7;
                }
            `;
            document.head.appendChild(style);
        },
        
        // 创建面板
        createPanel() {
            this.panel = document.createElement('div');
            this.panel.className = 'rm-panel rm-container';
            
            this.panel.innerHTML = `
                <div class="rm-header">
                    <h2 class="rm-title">接口请求监控器</h2>
                    <button class="rm-close-btn">&times;</button>
                </div>
                
                <div class="rm-toolbar">
                    <input type="text" class="rm-search" placeholder="搜索请求或响应...">
                    <button class="rm-button rm-clear-btn">清除筛选</button>
                    <div class="rm-active-tag-container" style="display: none;">
                        <div class="rm-active-tag-indicator">
                            <span class="rm-active-tag-text"></span>
                            <span class="rm-active-tag-clear">×</span>
                        </div>
                    </div>
                </div>
                
                <div class="rm-focus-tags-container">
                    <div class="rm-focus-tags-header">
                        <h3>重点关注</h3>
                        <button class="rm-button rm-add-focus-tag-btn">添加</button>
                    </div>
                    <div class="rm-focus-tags-list"></div>
                    <div class="rm-focus-tags-form" style="display: none;">
                        <input type="text" class="rm-focus-tag-input" placeholder="输入关注的URL标签">
                        <input type="text" class="rm-focus-url-pattern" placeholder="输入生效的URL模式 (例如: https://example.com/*)">
                        <div class="rm-focus-form-buttons">
                            <button class="rm-button rm-save-focus-tag-btn">保存</button>
                            <button class="rm-button rm-cancel-focus-tag-btn">取消</button>
                        </div>
                    </div>
                    <div class="rm-matching-focus-tags"></div>
                </div>
                
                <div class="rm-content">
                    <div class="rm-request-list">
                        <div class="rm-empty-state">
                            <div class="rm-empty-icon">📊</div>
                            <p>暂无请求记录</p>
                        </div>
                    </div>
                    
                    <div class="rm-detail-view">
                        <div class="rm-empty-state">
                            <div class="rm-empty-icon">👈</div>
                            <p>选择一个请求查看详情</p>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(this.panel);
            this.requestList = this.panel.querySelector('.rm-request-list');
            this.detailView = this.panel.querySelector('.rm-detail-view');
            
            // 绑定事件
            this.panel.querySelector('.rm-close-btn').addEventListener('click', () => this.togglePanel());
            
            const searchInput = this.panel.querySelector('.rm-search');
            searchInput.addEventListener('input', () => {
                requestStore.setFilter(searchInput.value);
            });
            
            this.panel.querySelector('.rm-clear-btn').addEventListener('click', () => {
                requestStore.clearFilters();
                // 清除搜索框内容
                this.panel.querySelector('.rm-search').value = '';
                this.updateActiveTagIndicator();
            });
            
            // 添加标签清除事件
            const tagClearBtn = this.panel.querySelector('.rm-active-tag-clear');
            tagClearBtn.addEventListener('click', () => {
                requestStore.toggleTag(null);
                this.updateActiveTagIndicator();
            });
            
            // 重点关注相关事件
            this.panel.querySelector('.rm-add-focus-tag-btn').addEventListener('click', () => {
                this.panel.querySelector('.rm-focus-tags-form').style.display = 'block';
            });
            
            this.panel.querySelector('.rm-save-focus-tag-btn').addEventListener('click', () => {
                const tagInput = this.panel.querySelector('.rm-focus-tag-input');
                const urlPatternInput = this.panel.querySelector('.rm-focus-url-pattern');
                
                const tag = tagInput.value.trim();
                const urlPattern = urlPatternInput.value.trim();
                
                if (tag && urlPattern) {
                    requestStore.addFocusTag(tag, urlPattern);
                    this.updateFocusTagsList();
                    this.updateMatchingFocusTags();
                    
                    // 清空输入框并隐藏表单
                    tagInput.value = '';
                    urlPatternInput.value = '';
                    this.panel.querySelector('.rm-focus-tags-form').style.display = 'none';
                }
            });
            
            this.panel.querySelector('.rm-cancel-focus-tag-btn').addEventListener('click', () => {
                // 清空输入框并隐藏表单
                this.panel.querySelector('.rm-focus-tag-input').value = '';
                this.panel.querySelector('.rm-focus-url-pattern').value = '';
                this.panel.querySelector('.rm-focus-tags-form').style.display = 'none';
            });
            
            // 初始化重点关注标签列表
            this.updateFocusTagsList();
            this.updateMatchingFocusTags();
        },
        
        // 创建切换按钮
        createToggleButton() {
            const button = document.createElement('div');
            button.className = 'rm-toggle-btn-container';
            button.innerHTML = `
                <button class="rm-toggle-btn">
                    <span>📊</span>
                </button>
            `;
            
            document.body.appendChild(button);
            
            // 绑定点击事件
            button.querySelector('.rm-toggle-btn').addEventListener('click', () => {
                this.togglePanel();
            });
        },
        
        // 切换面板显示/隐藏
        togglePanel() {
            this.isVisible = !this.isVisible;
            this.panel.classList.toggle('rm-visible', this.isVisible);
            
            // 当面板显示时，更新匹配的重点关注标签
            if (this.isVisible) {
                this.updateMatchingFocusTags();
            }
        },
        
        // 更新请求列表
        updateRequestList() {
            this.requestList.innerHTML = '';
            
            if (requestStore.filteredRequests.length === 0) {
                this.requestList.innerHTML = `
                    <div class="rm-empty-state">
                        <div class="rm-empty-icon">📊</div>
                        <p>暂无请求记录</p>
                    </div>
                `;
                return;
            }
            
            // 使用单一分组显示所有请求
            const requestsContainer = document.createElement('div');
            
            requestStore.filteredRequests.forEach(request => {
                const requestItem = document.createElement('div');
                requestItem.className = 'rm-request-item';
                requestItem.dataset.id = request.id;
                
                const methodClass = `rm-method-${request.method.toLowerCase()}`;
                
                requestItem.innerHTML = `
                    <div>
                        <span class="rm-request-method ${methodClass}">${request.method}</span>
                        <span class="rm-request-status">${request.status}</span>
                    </div>
                    <div class="rm-request-url">${this.getDisplayUrl(request.url)}</div>
                    <div class="rm-request-time">${this.formatTime(request.time)}</div>
                    <div class="rm-request-tags"></div>
                `;
                
                // 添加标签
                const tagsContainer = requestItem.querySelector('.rm-request-tags');
                if (request.tags && request.tags.length > 0) {
                    request.tags.forEach(tag => {
                        const tagElement = document.createElement('span');
                        tagElement.className = 'rm-tag';
                        if (tag === requestStore.activeTag) {
                            tagElement.classList.add('rm-active');
                        }
                        tagElement.textContent = tag;
                        
                        tagElement.addEventListener('click', (e) => {
                            e.stopPropagation(); // 防止触发请求项的点击事件
                            requestStore.toggleTag(tag);
                            this.updateActiveTagIndicator();
                        });
                        
                        tagsContainer.appendChild(tagElement);
                    });
                }
                
                requestItem.addEventListener('click', () => {
                    this.showRequestDetails(request);
                    
                    // 移除其他选中项
                    this.requestList.querySelectorAll('.rm-request-item').forEach(item => {
                        item.classList.remove('rm-selected');
                    });
                    
                    // 添加选中样式
                    requestItem.classList.add('rm-selected');
                });
                
                requestsContainer.appendChild(requestItem);
            });
            
            this.requestList.appendChild(requestsContainer);
            
            // 更新活动标签指示器
            this.updateActiveTagIndicator();
        },
        
        // 更新活动标签指示器
        updateActiveTagIndicator() {
            const tagContainer = this.panel.querySelector('.rm-active-tag-container');
            const tagText = this.panel.querySelector('.rm-active-tag-text');
            
            if (requestStore.activeTag) {
                tagContainer.style.display = 'block';
                tagText.textContent = `标签: ${requestStore.activeTag}`;
            } else {
                tagContainer.style.display = 'none';
            }
        },
        
        // 显示请求详情
        showRequestDetails(request) {
            this.detailView.innerHTML = '';
            
            const detailHeader = document.createElement('div');
            detailHeader.className = 'rm-detail-header';
            
            const methodClass = `rm-method-${request.method.toLowerCase()}`;
            
            detailHeader.innerHTML = `
                <div class="rm-detail-url">
                    <span class="rm-request-method ${methodClass}">${request.method}</span>
                    ${request.url}
                    <button class="rm-copy-btn" data-content="${request.url}">复制</button>
                </div>
                <div class="rm-detail-info">
                    <div>状态: ${request.status}</div>
                    <div>时间: ${this.formatTime(request.time, true)}</div>
                    <div>耗时: ${request.duration}ms</div>
                </div>
            `;
            
            this.detailView.appendChild(detailHeader);
            
            // 创建选项卡
            const tabs = document.createElement('div');
            tabs.className = 'rm-tabs';
            tabs.innerHTML = `
                <div class="rm-tab rm-active" data-tab="response">响应</div>
                <div class="rm-tab" data-tab="headers">请求头</div>
                <div class="rm-tab" data-tab="response-headers">响应头</div>
            `;
            
            this.detailView.appendChild(tabs);
            
            // 响应内容
            const responseContent = document.createElement('div');
            responseContent.className = 'rm-tab-content rm-active';
            responseContent.dataset.tab = 'response';
            
            if (request.responseType === 'json') {
                try {
                    const jsonData = typeof request.responseText === 'string' 
                        ? JSON.parse(request.responseText) 
                        : request.responseText;
                    
                    const jsonViewer = document.createElement('div');
                    jsonViewer.className = 'rm-json-viewer';
                    jsonViewer.appendChild(this.renderJson(jsonData));
                    
                    responseContent.appendChild(jsonViewer);
                } catch (e) {
                    responseContent.innerHTML = `
                        <div class="rm-detail-section">
                            <div class="rm-detail-section-title">响应内容</div>
                            <pre class="rm-code">${this.escapeHtml(request.responseText || '')}</pre>
                        </div>
                    `;
                }
            } else {
                responseContent.innerHTML = `
                    <div class="rm-detail-section">
                        <div class="rm-detail-section-title">响应内容</div>
                        <pre class="rm-code">${this.escapeHtml(request.responseText || '')}</pre>
                    </div>
                `;
            }
            
            // 请求头
            const headersContent = document.createElement('div');
            headersContent.className = 'rm-tab-content';
            headersContent.dataset.tab = 'headers';
            
            if (request.requestHeaders) {
                const headersList = document.createElement('div');
                headersList.className = 'rm-detail-section';
                
                const headersTitle = document.createElement('div');
                headersTitle.className = 'rm-detail-section-title';
                headersTitle.textContent = '请求头';
                
                const headersCode = document.createElement('pre');
                headersCode.className = 'rm-code';
                
                let headersText = '';
                for (const [key, value] of Object.entries(request.requestHeaders)) {
                    headersText += `${key}: ${value}\n`;
                }
                
                headersCode.textContent = headersText;
                
                headersList.appendChild(headersTitle);
                headersList.appendChild(headersCode);
                headersContent.appendChild(headersList);
            } else {
                headersContent.innerHTML = `
                    <div class="rm-empty-state">
                        <p>无法获取请求头信息</p>
                    </div>
                `;
            }
            
            // 响应头
            const responseHeadersContent = document.createElement('div');
            responseHeadersContent.className = 'rm-tab-content';
            responseHeadersContent.dataset.tab = 'response-headers';
            
            if (request.responseHeaders) {
                const headersList = document.createElement('div');
                headersList.className = 'rm-detail-section';
                
                const headersTitle = document.createElement('div');
                headersTitle.className = 'rm-detail-section-title';
                headersTitle.textContent = '响应头';
                
                const headersCode = document.createElement('pre');
                headersCode.className = 'rm-code';
                
                let headersText = '';
                for (const [key, value] of Object.entries(request.responseHeaders)) {
                    headersText += `${key}: ${value}\n`;
                }
                
                headersCode.textContent = headersText;
                
                headersList.appendChild(headersTitle);
                headersList.appendChild(headersCode);
                responseHeadersContent.appendChild(headersList);
            } else {
                responseHeadersContent.innerHTML = `
                    <div class="rm-empty-state">
                        <p>无法获取响应头信息</p>
                    </div>
                `;
            }
            
            this.detailView.appendChild(responseContent);
            this.detailView.appendChild(headersContent);
            this.detailView.appendChild(responseHeadersContent);
            
            // 绑定选项卡事件
            tabs.querySelectorAll('.rm-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    // 移除所有活动状态
                    tabs.querySelectorAll('.rm-tab').forEach(t => t.classList.remove('rm-active'));
                    this.detailView.querySelectorAll('.rm-tab-content').forEach(c => c.classList.remove('rm-active'));
                    
                    // 设置当前选项卡为活动状态
                    tab.classList.add('rm-active');
                    const tabName = tab.dataset.tab;
                    this.detailView.querySelector(`.rm-tab-content[data-tab="${tabName}"]`).classList.add('rm-active');
                });
            });
            
            // 绑定复制按钮事件
            this.detailView.querySelectorAll('.rm-copy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const content = btn.dataset.content;
                    navigator.clipboard.writeText(content)
                        .then(() => {
                            const originalText = btn.textContent;
                            btn.textContent = '已复制!';
                            setTimeout(() => {
                                btn.textContent = originalText;
                            }, 1500);
                        })
                        .catch(err => {
                            console.error('复制失败:', err);
                        });
                });
            });
        },
        
        // 渲染JSON数据
        renderJson(data, depth = 0, isLast = true) {
            // 添加延迟加载和虚拟化渲染逻辑
            if (depth === 0 && (Array.isArray(data) && data.length > 100 || 
                (typeof data === 'object' && data !== null && Object.keys(data).length > 100))) {
                return this.renderLargeJson(data);
            }
            
            const container = document.createElement('div');
            container.className = 'rm-json-item';
            
            // 处理简单类型（字符串、数字、布尔值、null）
            if (data === null || typeof data === 'boolean' || typeof data === 'number' || typeof data === 'string') {
                let valueSpan;
                let copyBtn;
                
                // 为字符串和数字添加复制按钮
                if (typeof data === 'string' || typeof data === 'number') {
                    const valueContainer = document.createElement('div');
                    valueContainer.className = 'rm-json-simple-value';
                    
                    copyBtn = document.createElement('button');
                    copyBtn.className = 'rm-json-copy-btn rm-json-simple-copy-btn';
                    copyBtn.textContent = '复制';
                    copyBtn.dataset.content = data.toString();
                    copyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(copyBtn.dataset.content)
                            .then(() => {
                                const originalText = copyBtn.textContent;
                                copyBtn.textContent = '已复制!';
                                setTimeout(() => {
                                    copyBtn.textContent = originalText;
                                }, 1500);
                            });
                    });
                    
                    if (data === null) {
                        valueSpan = document.createElement('span');
                        valueSpan.className = 'rm-json-null';
                        valueSpan.textContent = 'null';
                    } else if (typeof data === 'boolean') {
                        valueSpan = document.createElement('span');
                        valueSpan.className = 'rm-json-boolean';
                        valueSpan.textContent = data.toString();
                    } else if (typeof data === 'number') {
                        valueSpan = document.createElement('span');
                        valueSpan.className = 'rm-json-number';
                        valueSpan.textContent = data.toString();
                        valueContainer.appendChild(valueSpan);
                        valueContainer.appendChild(copyBtn);
                        container.appendChild(valueContainer);
                    } else if (typeof data === 'string') {
                        valueSpan = document.createElement('span');
                        valueSpan.className = 'rm-json-string';
                        
                        // 处理长字符串，添加适当的换行和样式
                        const escapedStr = this.escapeHtml(data);
                        valueSpan.textContent = `"${escapedStr}"`;
                        
                        // 如果字符串很长，添加特殊样式
                        if (data.length > 100) {
                            valueSpan.classList.add('rm-json-long-string');
                        }
                        
                        valueContainer.appendChild(valueSpan);
                        valueContainer.appendChild(copyBtn);
                        container.appendChild(valueContainer);
                    }
                } else {
                    if (data === null) {
                        valueSpan = document.createElement('span');
                        valueSpan.className = 'rm-json-null';
                        valueSpan.textContent = 'null';
                    } else if (typeof data === 'boolean') {
                        valueSpan = document.createElement('span');
                        valueSpan.className = 'rm-json-boolean';
                        valueSpan.textContent = data.toString();
                    }
                    container.appendChild(valueSpan);
                }
                
                if (!isLast && (typeof data !== 'string' && typeof data !== 'number')) {
                    const comma = document.createElement('span');
                    comma.className = 'rm-json-comma';
                    comma.textContent = ',';
                    container.appendChild(comma);
                } else if (!isLast) {
                    const comma = document.createElement('span');
                    comma.className = 'rm-json-comma';
                    comma.textContent = ',';
                    container.querySelector('.rm-json-simple-value').appendChild(comma);
                }
                
                return container;
            }
            
            if (Array.isArray(data)) {
                const arrayContainer = document.createElement('div');
                arrayContainer.className = 'rm-json-array';
                
                // 添加复制按钮
                const copyBtn = document.createElement('button');
                copyBtn.className = 'rm-json-copy-btn';
                copyBtn.textContent = '复制';
                copyBtn.dataset.content = JSON.stringify(data);
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(copyBtn.dataset.content)
                        .then(() => {
                            const originalText = copyBtn.textContent;
                            copyBtn.textContent = '已复制!';
                            setTimeout(() => {
                                copyBtn.textContent = originalText;
                            }, 1500);
                        });
                });
                
                const header = document.createElement('div');
                header.className = 'rm-json-array-header rm-collapsible rm-expanded';
                
                const arrayPreview = document.createElement('span');
                arrayPreview.className = 'rm-json-preview';
                arrayPreview.textContent = `Array(${data.length})`;
                
                const bracket = document.createElement('span');
                bracket.className = 'rm-json-bracket';
                bracket.textContent = '[';
                
                header.appendChild(bracket);
                header.appendChild(arrayPreview);
                header.appendChild(copyBtn);
                
                arrayContainer.appendChild(header);
                
                const content = document.createElement('div');
                content.className = 'rm-collapsible-content rm-expanded';
                
                data.forEach((item, index) => {
                    const itemRow = document.createElement('div');
                    itemRow.className = 'rm-json-array-item';
                    
                    const indexSpan = document.createElement('span');
                    indexSpan.className = 'rm-json-array-index';
                    indexSpan.textContent = index;
                    
                    itemRow.appendChild(indexSpan);
                    itemRow.appendChild(this.renderJson(item, depth + 1, index === data.length - 1));
                    
                    content.appendChild(itemRow);
                });
                
                const footer = document.createElement('div');
                footer.className = 'rm-json-array-footer';
                
                const closeBracket = document.createElement('span');
                closeBracket.className = 'rm-json-bracket';
                closeBracket.textContent = ']';
                footer.appendChild(closeBracket);
                
                if (!isLast) {
                    const comma = document.createElement('span');
                    comma.className = 'rm-json-comma';
                    comma.textContent = ',';
                    footer.appendChild(comma);
                }
                
                arrayContainer.appendChild(content);
                arrayContainer.appendChild(footer);
                
                // 添加折叠/展开功能
                header.addEventListener('click', (e) => {
                    if (e.target === copyBtn) return;
                    header.classList.toggle('rm-collapsed');
                    content.classList.toggle('rm-expanded');
                });
                
                container.appendChild(arrayContainer);
                return container;
            }
            
            if (typeof data === 'object') {
                const keys = Object.keys(data);
                
                const objectContainer = document.createElement('div');
                objectContainer.className = 'rm-json-object';
                
                // 添加复制按钮
                const copyBtn = document.createElement('button');
                copyBtn.className = 'rm-json-copy-btn';
                copyBtn.textContent = '复制';
                copyBtn.dataset.content = JSON.stringify(data);
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(copyBtn.dataset.content)
                        .then(() => {
                            const originalText = copyBtn.textContent;
                            copyBtn.textContent = '已复制!';
                            setTimeout(() => {
                                copyBtn.textContent = originalText;
                            }, 1500);
                        });
                });
                
                const header = document.createElement('div');
                header.className = 'rm-json-object-header rm-collapsible rm-expanded';
                
                const objectPreview = document.createElement('span');
                objectPreview.className = 'rm-json-preview';
                objectPreview.textContent = `Object(${keys.length})`;
                
                const bracket = document.createElement('span');
                bracket.className = 'rm-json-bracket';
                bracket.textContent = '{';
                
                header.appendChild(bracket);
                header.appendChild(objectPreview);
                header.appendChild(copyBtn);
                
                objectContainer.appendChild(header);
                
                const content = document.createElement('div');
                content.className = 'rm-collapsible-content rm-expanded';
                
                keys.forEach((key, index) => {
                    const propRow = document.createElement('div');
                    propRow.className = 'rm-json-property';
                    
                    const keySpan = document.createElement('span');
                    keySpan.className = 'rm-json-key';
                    keySpan.textContent = `"${key}"`;
                    
                    const colon = document.createElement('span');
                    colon.className = 'rm-json-colon';
                    colon.textContent = ': ';
                    
                    propRow.appendChild(keySpan);
                    propRow.appendChild(colon);
                    
                    // 检查值是否为简单类型
                    const value = data[key];
                    const isSimpleType = value === null || 
                                         typeof value === 'boolean' || 
                                         typeof value === 'number' || 
                                         typeof value === 'string';
                    
                    if (isSimpleType) {
                        // 简单类型直接在同一行显示
                        propRow.appendChild(this.renderJson(value, depth + 1, index === keys.length - 1));
                    } else {
                        // 复杂类型（对象、数组）在新行显示
                        const valueContainer = document.createElement('div');
                        valueContainer.className = 'rm-json-complex-value';
                        valueContainer.appendChild(this.renderJson(value, depth + 1, index === keys.length - 1));
                        propRow.appendChild(valueContainer);
                    }
                    
                    content.appendChild(propRow);
                });
                
                const footer = document.createElement('div');
                footer.className = 'rm-json-object-footer';
                
                const closeBracket = document.createElement('span');
                closeBracket.className = 'rm-json-bracket';
                closeBracket.textContent = '}';
                footer.appendChild(closeBracket);
                
                if (!isLast) {
                    const comma = document.createElement('span');
                    comma.className = 'rm-json-comma';
                    comma.textContent = ',';
                    footer.appendChild(comma);
                }
                
                objectContainer.appendChild(content);
                objectContainer.appendChild(footer);
                
                // 添加折叠/展开功能
                header.addEventListener('click', (e) => {
                    if (e.target === copyBtn) return;
                    header.classList.toggle('rm-collapsed');
                    content.classList.toggle('rm-expanded');
                });
                
                container.appendChild(objectContainer);
                return container;
            }
            
            // 未知类型
            container.textContent = String(data);
            if (!isLast) {
                const comma = document.createElement('span');
                comma.className = 'rm-json-comma';
                comma.textContent = ',';
                container.appendChild(comma);
            }
            return container;
        },
        
        // 渲染大型JSON数据的优化方法
        renderLargeJson(data) {
            const container = document.createElement('div');
            container.className = 'rm-json-large-container';
            
            // 创建警告信息
            const warningDiv = document.createElement('div');
            warningDiv.className = 'rm-json-large-warning';
            warningDiv.innerHTML = `
                <div class="rm-json-large-icon">⚠️</div>
                <div class="rm-json-large-message">
                    <p>大型JSON数据 - 完整渲染可能导致性能问题</p>
                    <div class="rm-json-large-options">
                        <button class="rm-button rm-json-render-btn">完整渲染</button>
                        <button class="rm-button rm-json-preview-btn">预览模式</button>
                        <button class="rm-button rm-json-raw-btn">查看原始数据</button>
                        <button class="rm-button rm-json-copy-btn">复制数据</button>
                    </div>
                </div>
            `;
            
            container.appendChild(warningDiv);
            
            // 创建内容容器
            const contentDiv = document.createElement('div');
            contentDiv.className = 'rm-json-large-content';
            container.appendChild(contentDiv);
            
            // 绑定按钮事件
            const renderBtn = warningDiv.querySelector('.rm-json-render-btn');
            const previewBtn = warningDiv.querySelector('.rm-json-preview-btn');
            const rawBtn = warningDiv.querySelector('.rm-json-raw-btn');
            const copyBtn = warningDiv.querySelector('.rm-json-copy-btn');
            
            // 完整渲染按钮
            renderBtn.addEventListener('click', () => {
                contentDiv.innerHTML = '';
                warningDiv.style.display = 'none';
                
                // 使用Web Worker进行渲染以避免阻塞主线程
                if (window.Worker) {
                    const jsonString = JSON.stringify(data);
                    
                    // 创建一个Blob URL来加载worker
                    const workerCode = `
                        self.onmessage = function(e) {
                            const jsonData = JSON.parse(e.data);
                            // 简单处理，返回HTML字符串
                            let html = self.processJsonToHtml(jsonData);
                            self.postMessage(html);
                        };
                        
                        self.processJsonToHtml = function(data, depth = 0) {
                            if (data === null) return '<span class="rm-json-null">null</span>';
                            if (typeof data === 'boolean') return '<span class="rm-json-boolean">' + data + '</span>';
                            if (typeof data === 'number') return '<span class="rm-json-number">' + data + '</span>';
                            if (typeof data === 'string') return '<span class="rm-json-string">"' + data.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"</span>';
                            
                            if (Array.isArray(data)) {
                                if (data.length === 0) return '[]';
                                let result = '<div class="rm-json-array"><div class="rm-json-array-header">[</div>';
                                data.forEach((item, index) => {
                                    result += '<div class="rm-json-array-item"><span class="rm-json-array-index">' + index + '</span>' + 
                                              self.processJsonToHtml(item, depth + 1) + 
                                              (index < data.length - 1 ? '<span class="rm-json-comma">,</span>' : '') + 
                                              '</div>';
                                });
                                result += '<div class="rm-json-array-footer">]</div></div>';
                                return result;
                            }
                            
                            if (typeof data === 'object') {
                                const keys = Object.keys(data);
                                if (keys.length === 0) return '{}';
                                
                                let result = '<div class="rm-json-object"><div class="rm-json-object-header">{</div>';
                                keys.forEach((key, index) => {
                                    result += '<div class="rm-json-property">' +
                                              '<span class="rm-json-key">"' + key + '"</span>' +
                                              '<span class="rm-json-colon">: </span>' +
                                              self.processJsonToHtml(data[key], depth + 1) +
                                              (index < keys.length - 1 ? '<span class="rm-json-comma">,</span>' : '') +
                                              '</div>';
                                });
                                result += '<div class="rm-json-object-footer">}</div></div>';
                                return result;
                            }
                            
                            return String(data);
                        };
                    `;
                    
                    const blob = new Blob([workerCode], { type: 'application/javascript' });
                    const workerUrl = URL.createObjectURL(blob);
                    const worker = new Worker(workerUrl);
                    
                    // 显示加载指示器
                    contentDiv.innerHTML = '<div class="rm-json-loading">正在渲染，请稍候...</div>';
                    
                    worker.onmessage = function(e) {
                        contentDiv.innerHTML = e.data;
                        
                        // 添加折叠/展开功能
                        contentDiv.querySelectorAll('.rm-json-array-header, .rm-json-object-header').forEach(header => {
                            header.addEventListener('click', () => {
                                const parent = header.parentElement;
                                const content = Array.from(parent.children).filter(el => 
                                    !el.classList.contains('rm-json-array-header') && 
                                    !el.classList.contains('rm-json-object-header') &&
                                    !el.classList.contains('rm-json-array-footer') &&
                                    !el.classList.contains('rm-json-object-footer')
                                );
                                
                                content.forEach(el => {
                                    el.style.display = el.style.display === 'none' ? '' : 'none';
                                });
                                
                                header.classList.toggle('rm-collapsed');
                            });
                        });
                        
                        // 清理worker
                        worker.terminate();
                        URL.revokeObjectURL(workerUrl);
                    };
                    
                    worker.postMessage(jsonString);
                } else {
                    // 如果不支持Web Worker，则分批渲染
                    this.renderJsonInBatches(data, contentDiv);
                }
            });
            
            // 预览模式按钮
            previewBtn.addEventListener('click', () => {
                contentDiv.innerHTML = '';
                
                // 创建预览内容
                const previewContent = this.createJsonPreview(data);
                contentDiv.appendChild(previewContent);
            });
            
            // 原始数据按钮
            rawBtn.addEventListener('click', () => {
                contentDiv.innerHTML = '';
                
                const pre = document.createElement('pre');
                pre.className = 'rm-code';
                
                // 使用分段处理大型字符串
                const jsonString = JSON.stringify(data, null, 2);
                
                // 如果字符串非常大，分段添加
                if (jsonString.length > 100000) {
                    pre.textContent = '正在加载...';
                    
                    setTimeout(() => {
                        // 使用文档片段减少重排
                        const fragment = document.createDocumentFragment();
                        const chunkSize = 50000;
                        
                        for (let i = 0; i < jsonString.length; i += chunkSize) {
                            const chunk = jsonString.substring(i, i + chunkSize);
                            const textNode = document.createTextNode(chunk);
                            fragment.appendChild(textNode);
                            
                            // 每添加一个块后让出主线程
                            if (i + chunkSize < jsonString.length) {
                                setTimeout(() => {
                                    pre.appendChild(fragment.cloneNode(true));
                                }, 0);
                            }
                        }
                        
                        pre.textContent = '';
                        pre.appendChild(fragment);
                    }, 50);
                } else {
                    pre.textContent = jsonString;
                }
                
                contentDiv.appendChild(pre);
            });
            
            // 复制数据按钮
            copyBtn.addEventListener('click', () => {
                const jsonString = JSON.stringify(data, null, 2);
                
                navigator.clipboard.writeText(jsonString)
                    .then(() => {
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = '已复制!';
                        setTimeout(() => {
                            copyBtn.textContent = originalText;
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('复制失败:', err);
                        alert('复制失败，请手动复制');
                    });
            });
            
            // 默认显示预览
            setTimeout(() => {
                previewBtn.click();
            }, 0);
            
            return container;
        },
        
        // 创建JSON预览
        createJsonPreview(data) {
            const container = document.createElement('div');
            container.className = 'rm-json-preview-container';
            
            if (Array.isArray(data)) {
                // 数组预览
                const arrayInfo = document.createElement('div');
                arrayInfo.className = 'rm-json-preview-info';
                arrayInfo.innerHTML = `<span class="rm-json-preview-type">数组</span> - 包含 <span class="rm-json-preview-count">${data.length}</span> 个元素`;
                container.appendChild(arrayInfo);
                
                // 预览前10个元素
                const previewCount = Math.min(10, data.length);
                const previewContainer = document.createElement('div');
                previewContainer.className = 'rm-json-preview-items';
                
                for (let i = 0; i < previewCount; i++) {
                    const item = data[i];
                    const itemPreview = document.createElement('div');
                    itemPreview.className = 'rm-json-preview-item';
                    
                    const itemIndex = document.createElement('span');
                    itemIndex.className = 'rm-json-preview-index';
                    itemIndex.textContent = `[${i}]`;
                    
                    const itemValue = document.createElement('span');
                    itemValue.className = 'rm-json-preview-value';
                    
                    if (item === null) {
                        itemValue.className += ' rm-json-null';
                        itemValue.textContent = 'null';
                    } else if (typeof item === 'boolean') {
                        itemValue.className += ' rm-json-boolean';
                        itemValue.textContent = item.toString();
                    } else if (typeof item === 'number') {
                        itemValue.className += ' rm-json-number';
                        itemValue.textContent = item.toString();
                    } else if (typeof item === 'string') {
                        itemValue.className += ' rm-json-string';
                        itemValue.textContent = item.length > 50 ? `"${item.substring(0, 47)}..."` : `"${item}"`;
                    } else if (Array.isArray(item)) {
                        itemValue.textContent = `Array(${item.length})`;
                    } else if (typeof item === 'object') {
                        itemValue.textContent = `Object(${Object.keys(item).length})`;
                    }
                    
                    itemPreview.appendChild(itemIndex);
                    itemPreview.appendChild(itemValue);
                    previewContainer.appendChild(itemPreview);
                }
                
                if (data.length > 10) {
                    const moreItems = document.createElement('div');
                    moreItems.className = 'rm-json-preview-more';
                    moreItems.textContent = `... 还有 ${data.length - 10} 个元素`;
                    previewContainer.appendChild(moreItems);
                }
                
                container.appendChild(previewContainer);
            } else if (typeof data === 'object' && data !== null) {
                // 对象预览
                const keys = Object.keys(data);
                
                const objectInfo = document.createElement('div');
                objectInfo.className = 'rm-json-preview-info';
                objectInfo.innerHTML = `<span class="rm-json-preview-type">对象</span> - 包含 <span class="rm-json-preview-count">${keys.length}</span> 个属性`;
                container.appendChild(objectInfo);
                
                // 预览前10个属性
                const previewCount = Math.min(10, keys.length);
                const previewContainer = document.createElement('div');
                previewContainer.className = 'rm-json-preview-items';
                
                for (let i = 0; i < previewCount; i++) {
                    const key = keys[i];
                    const value = data[key];
                    
                    const propPreview = document.createElement('div');
                    propPreview.className = 'rm-json-preview-item';
                    
                    const propKey = document.createElement('span');
                    propKey.className = 'rm-json-preview-key';
                    propKey.textContent = key;
                    
                    const propColon = document.createElement('span');
                    propColon.className = 'rm-json-preview-colon';
                    propColon.textContent = ': ';
                    
                    const propValue = document.createElement('span');
                    propValue.className = 'rm-json-preview-value';
                    
                    if (value === null) {
                        propValue.className += ' rm-json-null';
                        propValue.textContent = 'null';
                    } else if (typeof value === 'boolean') {
                        propValue.className += ' rm-json-boolean';
                        propValue.textContent = value.toString();
                    } else if (typeof value === 'number') {
                        propValue.className += ' rm-json-number';
                        propValue.textContent = value.toString();
                    } else if (typeof value === 'string') {
                        propValue.className += ' rm-json-string';
                        propValue.textContent = value.length > 50 ? `"${value.substring(0, 47)}..."` : `"${value}"`;
                    } else if (Array.isArray(value)) {
                        propValue.textContent = `Array(${value.length})`;
                    } else if (typeof value === 'object') {
                        propValue.textContent = `Object(${Object.keys(value).length})`;
                    }
                    
                    propPreview.appendChild(propKey);
                    propPreview.appendChild(propColon);
                    propPreview.appendChild(propValue);
                    previewContainer.appendChild(propPreview);
                }
                
                if (keys.length > 10) {
                    const moreProps = document.createElement('div');
                    moreProps.className = 'rm-json-preview-more';
                    moreProps.textContent = `... 还有 ${keys.length - 10} 个属性`;
                    previewContainer.appendChild(moreProps);
                }
                
                container.appendChild(previewContainer);
            }
            
            return container;
        },
        
        // 分批渲染JSON
        renderJsonInBatches(data, container) {
            container.innerHTML = '<div class="rm-json-loading">正在渲染，请稍候...</div>';
            
            setTimeout(() => {
                container.innerHTML = '';
                
                if (Array.isArray(data)) {
                    const arrayContainer = document.createElement('div');
                    arrayContainer.className = 'rm-json-array';
                    
                    const header = document.createElement('div');
                    header.className = 'rm-json-array-header';
                    header.innerHTML = `<span class="rm-json-bracket">[</span><span class="rm-json-preview">Array(${data.length})</span>`;
                    arrayContainer.appendChild(header);
                    
                    // 创建一个文档片段来存储所有元素
                    const fragment = document.createDocumentFragment();
                    
                    // 分批处理数组元素
                    const batchSize = 50;
                    let currentIndex = 0;
                    
                    const processNextBatch = () => {
                        if (currentIndex >= data.length) {
                            // 所有批次处理完毕，添加结束括号
                            const footer = document.createElement('div');
                            footer.className = 'rm-json-array-footer';
                            footer.innerHTML = '<span class="rm-json-bracket">]</span>';
                            arrayContainer.appendChild(footer);
                            return;
                        }
                        
                        const endIndex = Math.min(currentIndex + batchSize, data.length);
                        
                        for (let i = currentIndex; i < endIndex; i++) {
                            const itemRow = document.createElement('div');
                            itemRow.className = 'rm-json-array-item';
                            
                            const indexSpan = document.createElement('span');
                            indexSpan.className = 'rm-json-array-index';
                            indexSpan.textContent = i;
                            
                            itemRow.appendChild(indexSpan);
                            itemRow.appendChild(this.renderSimplifiedJson(data[i], 1, i === data.length - 1));
                            
                            fragment.appendChild(itemRow);
                        }
                        
                        arrayContainer.appendChild(fragment.cloneNode(true));
                        currentIndex = endIndex;
                        
                        // 使用requestAnimationFrame来处理下一批
                        requestAnimationFrame(processNextBatch);
                    };
                    
                    // 开始处理第一批
                    processNextBatch();
                    
                    container.appendChild(arrayContainer);
                } else if (typeof data === 'object' && data !== null) {
                    const keys = Object.keys(data);
                    
                    const objectContainer = document.createElement('div');
                    objectContainer.className = 'rm-json-object';
                    
                    const header = document.createElement('div');
                    header.className = 'rm-json-object-header';
                    header.innerHTML = `<span class="rm-json-bracket">{</span><span class="rm-json-preview">Object(${keys.length})</span>`;
                    objectContainer.appendChild(header);
                    
                    // 创建一个文档片段来存储所有属性
                    const fragment = document.createDocumentFragment();
                    
                    // 分批处理对象属性
                    const batchSize = 50;
                    let currentIndex = 0;
                    
                    const processNextBatch = () => {
                        if (currentIndex >= keys.length) {
                            // 所有批次处理完毕，添加结束括号
                            const footer = document.createElement('div');
                            footer.className = 'rm-json-object-footer';
                            footer.innerHTML = '<span class="rm-json-bracket">}</span>';
                            objectContainer.appendChild(footer);
                            return;
                        }
                        
                        const endIndex = Math.min(currentIndex + batchSize, keys.length);
                        
                        for (let i = currentIndex; i < endIndex; i++) {
                            const key = keys[i];
                            
                            const propRow = document.createElement('div');
                            propRow.className = 'rm-json-property';
                            
                            const keySpan = document.createElement('span');
                            keySpan.className = 'rm-json-key';
                            keySpan.textContent = `"${key}"`;
                            
                            const colon = document.createElement('span');
                            colon.className = 'rm-json-colon';
                            colon.textContent = ': ';
                            
                            propRow.appendChild(keySpan);
                            propRow.appendChild(colon);
                            propRow.appendChild(this.renderSimplifiedJson(data[key], 1, i === keys.length - 1));
                            
                            fragment.appendChild(propRow);
                        }
                        
                        objectContainer.appendChild(fragment.cloneNode(true));
                        currentIndex = endIndex;
                        
                        // 使用requestAnimationFrame来处理下一批
                        requestAnimationFrame(processNextBatch);
                    };
                    
                    // 开始处理第一批
                    processNextBatch();
                    
                    container.appendChild(objectContainer);
                }
            }, 50);
        },
        
        // 简化的JSON渲染，用于批处理
        renderSimplifiedJson(data, depth, isLast) {
            const container = document.createElement('div');
            container.className = 'rm-json-item';
            
            if (data === null || typeof data === 'boolean' || typeof data === 'number' || typeof data === 'string') {
                if (data === null) {
                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'rm-json-null';
                    valueSpan.textContent = 'null';
                    container.appendChild(valueSpan);
                } else if (typeof data === 'boolean') {
                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'rm-json-boolean';
                    valueSpan.textContent = data.toString();
                    container.appendChild(valueSpan);
                } else if (typeof data === 'number') {
                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'rm-json-number';
                    valueSpan.textContent = data.toString();
                    container.appendChild(valueSpan);
                } else if (typeof data === 'string') {
                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'rm-json-string';
                    
                    // 处理长字符串
                    if (data.length > 100) {
                        valueSpan.textContent = `"${data.substring(0, 97)}..."`;
                        valueSpan.title = data;
                    } else {
                        valueSpan.textContent = `"${this.escapeHtml(data)}"`;
                    }
                    
                    container.appendChild(valueSpan);
                }
                
                if (!isLast) {
                    const comma = document.createElement('span');
                    comma.className = 'rm-json-comma';
                    comma.textContent = ',';
                    container.appendChild(comma);
                }
                
                return container;
            }
            
            if (Array.isArray(data)) {
                const preview = document.createElement('span');
                preview.className = 'rm-json-collapsed-preview';
                preview.textContent = `[Array(${data.length})]`;
                
                if (!isLast) {
                    const comma = document.createElement('span');
                    comma.className = 'rm-json-comma';
                    comma.textContent = ',';
                    preview.appendChild(comma);
                }
                
                container.appendChild(preview);
                return container;
            }
            
            if (typeof data === 'object') {
                const keys = Object.keys(data);
                
                const preview = document.createElement('span');
                preview.className = 'rm-json-collapsed-preview';
                preview.textContent = `{Object(${keys.length})}`;
                
                if (!isLast) {
                    const comma = document.createElement('span');
                    comma.className = 'rm-json-comma';
                    comma.textContent = ',';
                    preview.appendChild(comma);
                }
                
                container.appendChild(preview);
                return container;
            }
            
            container.textContent = String(data);
            return container;
        },
        
        // 获取显示URL
        getDisplayUrl(url) {
            try {
                const urlObj = new URL(url);
                const path = urlObj.pathname + urlObj.search;
                return path.length > 50 ? path.substring(0, 47) + '...' : path;
            } catch (e) {
                return url;
            }
        },
        
        // 格式化时间
        formatTime(timestamp, detailed = false) {
            const date = new Date(timestamp);
            
            if (detailed) {
                return date.toLocaleString();
            }
            
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const seconds = date.getSeconds().toString().padStart(2, '0');
            
            return `${hours}:${minutes}:${seconds}`;
        },
        
        // HTML转义
        escapeHtml(text) {
            if (!text) return '';
            
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },
        
        // 更新重点关注标签列表
        updateFocusTagsList() {
            const container = this.panel.querySelector('.rm-focus-tags-list');
            container.innerHTML = '';
            
            if (requestStore.focusTags.length === 0) {
                container.innerHTML = '<div class="rm-empty-focus-tags">暂无重点关注标签</div>';
                return;
            }
            
            requestStore.focusTags.forEach((item, index) => {
                const tagElement = document.createElement('div');
                tagElement.className = 'rm-focus-tag-item';
                tagElement.innerHTML = `
                    <span class="rm-focus-tag-text">${item.tag} (${item.urlPattern})</span>
                    <span class="rm-focus-tag-delete" data-index="${index}">×</span>
                `;
                
                container.appendChild(tagElement);
            });
            
            // 绑定删除事件
            container.querySelectorAll('.rm-focus-tag-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    requestStore.removeFocusTag(index);
                    this.updateFocusTagsList();
                    this.updateMatchingFocusTags();
                });
            });
        },
        
        // 更新匹配当前页面的重点关注标签
        updateMatchingFocusTags() {
            const container = this.panel.querySelector('.rm-matching-focus-tags');
            container.innerHTML = '';
            
            const matchingTags = requestStore.getMatchingFocusTags();
            
            if (matchingTags.length === 0) {
                return;
            }
            
            const title = document.createElement('div');
            title.className = 'rm-matching-focus-title';
            title.textContent = '当前页面匹配:';
            container.appendChild(title);
            
            matchingTags.forEach(item => {
                const tagElement = document.createElement('div');
                tagElement.className = 'rm-matching-focus-tag';
                tagElement.textContent = item.tag;
                
                tagElement.addEventListener('click', () => {
                    // 设置筛选条件
                    requestStore.setFilter(item.tag);
                    this.panel.querySelector('.rm-search').value = item.tag;
                });
                
                container.appendChild(tagElement);
            });
        }
    };

    // 请求拦截器
    const requestInterceptor = {
        nextRequestId: 1,
        
        // 初始化
        init() {
            this.interceptXHR();
            this.interceptFetch();
        },
        
        // 检查是否为资源请求
        isResourceRequest(url, contentType) {
            try {
                const urlObj = new URL(url);
                const path = urlObj.pathname.toLowerCase();
                
                // 检查文件扩展名
                const resourceExtensions = [
                    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico', // 图片
                    '.js', '.css', // 脚本和样式
                    '.woff', '.woff2', '.ttf', '.eot', '.otf', // 字体
                    '.mp3', '.mp4', '.webm', '.ogg', '.wav', // 媒体
                    '.pdf', '.doc', '.docx', '.xls', '.xlsx', // 文档
                ];
                
                // 检查文件扩展名
                if (resourceExtensions.some(ext => path.endsWith(ext))) {
                    return true;
                }
                
                // 检查内容类型
                if (contentType) {
                    const resourceContentTypes = [
                        'image/', 'font/', 'audio/', 'video/',
                        'text/css', 'text/javascript', 'application/javascript',
                        'application/font', 'application/pdf'
                    ];
                    
                    if (resourceContentTypes.some(type => contentType.includes(type))) {
                        return true;
                    }
                }
                
                return false;
            } catch (e) {
                return false;
            }
        },
        
        // 拦截XMLHttpRequest
        interceptXHR() {
            const originalXHR = unsafeWindow.XMLHttpRequest;
            const self = this;
            
            unsafeWindow.XMLHttpRequest = function() {
                const xhr = new originalXHR();
                const requestId = self.nextRequestId++;
                
                const request = {
                    id: requestId,
                    method: '',
                    url: '',
                    time: Date.now(),
                    duration: 0,
                    status: 0,
                    requestHeaders: {},
                    responseHeaders: {},
                    responseType: '',
                    responseText: ''
                };
                
                // 拦截open方法
                const originalOpen = xhr.open;
                xhr.open = function(method, url) {
                    request.method = method;
                    request.url = url;
                    originalOpen.apply(this, arguments);
                };
                
                // 拦截setRequestHeader方法
                const originalSetRequestHeader = xhr.setRequestHeader;
                xhr.setRequestHeader = function(name, value) {
                    request.requestHeaders[name] = value;
                    originalSetRequestHeader.apply(this, arguments);
                };
                
                // 拦截send方法
                const originalSend = xhr.send;
                xhr.send = function(body) {
                    // 监听加载完成事件
                    xhr.addEventListener('load', function() {
                        request.duration = Date.now() - request.time;
                        request.status = xhr.status;
                        
                        // 获取响应头
                        const allHeaders = xhr.getAllResponseHeaders();
                        const headerLines = allHeaders.split('\r\n');
                        headerLines.forEach(line => {
                            if (line) {
                                const parts = line.split(': ');
                                const name = parts[0];
                                const value = parts.slice(1).join(': ');
                                request.responseHeaders[name] = value;
                            }
                        });
                        
                        // 获取内容类型
                        const contentType = xhr.getResponseHeader('content-type') || '';
                        
                        // 检查是否为资源请求
                        if (self.isResourceRequest(request.url, contentType)) {
                            return; // 跳过资源请求
                        }
                        
                        // 获取响应内容
                        try {
                            if (contentType.includes('application/json')) {
                                request.responseType = 'json';
                                if (xhr.responseType === 'json') {
                                    request.responseText = xhr.response;
                                } else {
                                    request.responseText = xhr.responseText;
                                }
                            } else {
                                request.responseType = 'text';
                                request.responseText = xhr.responseText;
                            }
                        } catch (e) {
                            request.responseType = 'unknown';
                            request.responseText = '无法读取响应内容';
                        }
                        
                        // 添加到请求存储
                        requestStore.addRequest(request);
                    });
                    
                    originalSend.apply(this, arguments);
                };
                
                return xhr;
            };
        },
        
        // 拦截fetch
        interceptFetch() {
            const originalFetch = unsafeWindow.fetch;
            const self = this;
            
            unsafeWindow.fetch = function(input, init = {}) {
                const requestId = self.nextRequestId++;
                const startTime = Date.now();
                
                let method = 'GET';
                let url = '';
                
                if (typeof input === 'string') {
                    url = input;
                } else if (input instanceof Request) {
                    url = input.url;
                    method = input.method || 'GET';
                }
                
                if (init.method) {
                    method = init.method;
                }
                
                // 检查URL是否为资源请求
                if (self.isResourceRequest(url)) {
                    return originalFetch.apply(this, arguments);
                }
                
                const request = {
                    id: requestId,
                    method: method,
                    url: url,
                    time: startTime,
                    duration: 0,
                    status: 0,
                    requestHeaders: init.headers || {},
                    responseHeaders: {},
                    responseType: '',
                    responseText: ''
                };
                
                return originalFetch.apply(this, arguments)
                    .then(response => {
                        request.duration = Date.now() - startTime;
                        request.status = response.status;
                        
                        // 获取响应头
                        response.headers.forEach((value, name) => {
                            request.responseHeaders[name] = value;
                        });
                        
                        // 检查内容类型
                        const contentType = response.headers.get('content-type') || '';
                        
                        // 再次检查是否为资源请求（基于响应头）
                        if (self.isResourceRequest(url, contentType)) {
                            return response;
                        }
                        
                        // 克隆响应以便读取内容
                        const clonedResponse = response.clone();
                        
                        if (contentType.includes('application/json')) {
                            request.responseType = 'json';
                            return clonedResponse.text().then(text => {
                                try {
                                    request.responseText = text;
                                } catch (e) {
                                    request.responseText = text;
                                }
                                
                                requestStore.addRequest(request);
                                return response;
                            });
                        } else {
                            request.responseType = 'text';
                            return clonedResponse.text().then(text => {
                                request.responseText = text;
                                requestStore.addRequest(request);
                                return response;
                            });
                        }
                    })
                    .catch(error => {
                        request.status = 0;
                        request.duration = Date.now() - startTime;
                        request.responseText = `请求失败: ${error.message}`;
                        requestStore.addRequest(request);
                        throw error;
                    });
            };
        }
    };

    // 等待DOM加载完成后初始化
    function initMonitor() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                uiManager.init();
                requestInterceptor.init();
            });
        } else {
            uiManager.init();
            requestInterceptor.init();
        }
    }

    // 初始化监控器
    initMonitor();
})();