// ==UserScript==
// @name         YiKeTu Watermark Remover
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Remove watermark from YiKeTu editor responses
// @author       You
// @match        https://www.yiketu.com/poster/editor*
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 拦截原始的 XMLHttpRequest
    const originalXHR = XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const originalOpen = xhr.open;

        xhr.open = function(method, url) {
            if (url.includes('index-bf0289c5-c03c2f9f.js')) {
                console.log('拦截到目标JS请求:', url);
                
                // 使用 GM_xmlhttpRequest 获取并修改内容
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function(response) {
                        let content = response.responseText;
                        content = content.replace(
                            /addWatermark\(\){[^}]+}/g,
                            'addWatermark(){}'
                        );
                        
                        // 重写 responseText
                        Object.defineProperty(xhr, 'responseText', {
                            get: function() {
                                return content;
                            }
                        });
                        
                        // 触发加载完成事件
                        xhr.dispatchEvent(new Event('load'));
                    }
                });
                
                // 阻止原始请求
                return;
            }
            originalOpen.apply(xhr, arguments);
        };

        return xhr;
    };

    console.log('水印移除脚本已启动');
})();