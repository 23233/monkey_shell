// ==UserScript==
// @name         获取小红书搜索笔记id
// @author       23233
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  获取笔记id
// @author       你的名字
// @match        https://www.xiaohongshu.com/search_result*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    let exportBtn = document.createElement('button');

    function createObservableArray(arr, callback) {
        return new Proxy(arr, {
            set: function(target, property, value, receiver) {
                target[property] = value;
                if (property !== 'length') {
                    callback(target);
                }
                return true;
            }
        });
    }

    let cmIds = createObservableArray([], function(arr) {
        exportBtn.textContent = `导出${arr.length}条笔记`;
    });

    var OriginalXMLHttpRequest = unsafeWindow.XMLHttpRequest;

    function ModifiedXMLHttpRequest() {
        var xhr = new OriginalXMLHttpRequest();
        var originalOpen = xhr.open;

        xhr.open = function(method, url, async, user, password) {
            if (url.endsWith('sns/web/v1/search/notes')) {
                console.log('拦截到搜索请求:', url);

                xhr.addEventListener('load', function () {
                    const data = JSON.parse(this.responseText);
                    cmIds.push(...data.data.items)
                });

                // 在此处可以添加你想要的拦截逻辑
            }

            originalOpen.apply(xhr, arguments);
        };

        return xhr;
    }

    unsafeWindow.XMLHttpRequest = ModifiedXMLHttpRequest;


    window.addEventListener('load', function () {
        exportBtn.textContent = '导出笔记';
        exportBtn.addEventListener('click', exportComments);

        let btnWrapper = document.createElement('div');
        btnWrapper.style.position = 'fixed';
        btnWrapper.style.right = '10px';
        btnWrapper.style.bottom = '10px';
        btnWrapper.appendChild(exportBtn);

        document.body.appendChild(btnWrapper);

    });

    function exportComments() {
        var queryString = window.location.search;
        var urlParams = new URLSearchParams(queryString);
        var keyword = urlParams.get('keyword');
        var decodedKeyword = decodeURIComponent(keyword);

        // 去重逻辑
        const uniqueCmIds = [];
        cmIds.forEach(item => {
            if (!uniqueCmIds.some(uid => uid.id === item.id)) {
                uniqueCmIds.push(item.id); // 仅保存ID
            }
        });

        // 将每个ID转换为一行文本
        let content = uniqueCmIds.join('\n');
        let blob = new Blob([content], {type: 'text/plain'});
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.download = `${decodedKeyword}_${uniqueCmIds.length}.txt`; // 使用TXT扩展名
        a.href = url;
        a.click();
    }

})();
