// ==UserScript==
// @name         Export QQ Music Comments
// @namespace    https://github.com/23233/monkey_shell
// @version      0.2
// @description  export qq music comments
// @author       23233
// @match        https://y.qq.com/n/ryqq/songDetail/*
// @icon         https://y.qq.com/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let cmIds = [];


    // 保存原始的XMLHttpRequest对象
    const originalXHR = window.XMLHttpRequest;

    const parseResponse = (req) => {

        let comments = [];

        if (req.data.CommentList) {
            comments = comments.concat(req.data.CommentList.Comments);
        }

        if (req.data.CommentList2) {
            comments = comments.concat(req.data.CommentList2.Comments);
        }

        if (req.data.CommentList3) {
            comments = comments.concat(req.data.CommentList3.Comments);
        }
        console.log("page datas",comments)
        return comments.map(item => {
            return {
                CmId: item.CmId,
                Nick: item.Nick,
                Content: item.Content
            };
        });
    }


    // 重新定义XMLHttpRequest
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();

        // 重写open方法
        const open = xhr.open;
        xhr.open = function() {
            console.log('XHR request intercepted:', arguments);
            if (arguments[0] === 'POST' && arguments[1].includes('musics.fcg')) {
                // 添加拦截处理
                xhr.addEventListener('load', function() {
                    const data = JSON.parse(this.responseText);
                    if (data.req_3 && data.req_3.data) {
                        console.log("req3")
                        cmIds = [...cmIds,...parseResponse(data.req_3)]
                    }else if (data.req_1 && data.req_1.data.CommentList){
                        console.log("req_1")
                        cmIds = [...cmIds,...parseResponse(data.req_1)]
                    }

                });
            }

            // 调用原始的open方法
            open.apply(xhr, arguments);
        };

        return xhr;
    };

    window.addEventListener('load', function() {
        let exportBtn = document.createElement('button');
        exportBtn.textContent = '导出评论';
        exportBtn.addEventListener('click', exportComments);

        let btnWrapper = document.createElement('div');
        btnWrapper.style.position = 'fixed';
        btnWrapper.style.right = '10px';
        btnWrapper.style.bottom = '10px';
        btnWrapper.appendChild(exportBtn);

        document.body.appendChild(btnWrapper);

    });

    function exportComments() {

        // 从当前页面URL中提取歌曲ID
        const songId = window.location.href.split('/').pop();
        // 去重逻辑
        const uniqueCmIds = [];
        cmIds.forEach(item => {
            if (!uniqueCmIds.some(uid => uid.CmId === item.CmId)) {
                uniqueCmIds.push(item);
            }
        });
        let content = JSON.stringify(uniqueCmIds);
        let blob = new Blob([content], {type: 'application/json'});
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.download = songId + '.json'; // 拼接歌曲ID作为文件名
        a.href = url;
        a.click();
    }
})();