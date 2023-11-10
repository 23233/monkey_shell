// ==UserScript==
// @name         Tieba Search Save to Csv
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  把贴吧搜索的结果每一页保存下载
// @author       23233
// @match        https://tieba.baidu.com/f/search/fm?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=baidu.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
     // 创建并添加按钮到页面
    const button = document.createElement('button');
    button.textContent = '导出CSV';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.right = '20px';
    button.style.zIndex = '1000';
    document.body.appendChild(button);

    // 定义一个函数来提取数据并转换为CSV格式
    function extractDataToCSV() {
        const items = document.querySelectorAll('.forum-item');
        let csvContent = '"fid","name","member","post","desc"\n';

        items.forEach(item => {
            const fid = item.querySelector('a[data-fid]').getAttribute('data-fid');
            const name = item.querySelector('.forum-name').textContent.trim();
            const member = item.querySelector('.member-icon + span').textContent.trim();
            const post = item.querySelector('.post-icon + span').textContent.trim();
            const desc = item.querySelector('.forum-brief').textContent.trim();

            // 仅当post大于1000并且member大于100时添加到CSV
            if (parseInt(post, 10) > 1000 && parseInt(member,10)> 100) {
                csvContent += `"${fid}","${name}","${member}","${post}","${desc}"\n`;
            }
        });

        // 创建并下载CSV文件
        if (csvContent !== '"fid","name","member","post","desc"\n') {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", generateFileName());
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // 从URL中提取kw和pn参数并生成文件名
    function generateFileName() {
        const params = new URLSearchParams(window.location.search);
        const qw = params.get('qw') || 'default_qw';
        const pn = params.get('pn') || 'default_pn';
        return `${qw}_${pn}_data.csv`;
    }

    // 为按钮添加点击事件监听器
    button.addEventListener('click', extractDataToCSV);
})();