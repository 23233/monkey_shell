// ==UserScript==
// @name         导出歌手的歌曲列表csv
// @namespace    http://tampermonkey.net/
// @version      2024-03-03
// @description  导出歌手的歌曲列表csv
// @author       23233
// @match        https://music.163.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=163.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const main = () => {

        const iframe = document.querySelector('iframe[name="contentFrame"]');
        if (!iframe) {
            console.error("未找到name为'contentFrame'的iframe。");
            return;
        }

        const button = document.createElement('button');
        button.textContent = '导出歌曲ID和名称';
        button.style.position = 'fixed';
        button.style.right = '20px';
        button.style.bottom = '100px';
        button.style.zIndex = '9999';
        button.style.padding = "5px"
        document.body.appendChild(button);

        button.addEventListener('click', function() {
            const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
            const elements = iframeDocument.querySelectorAll("tbody tr .ttc a");
            const data = [['id', 'name']]; // CSV头部
            elements.forEach((element) => {
                const href = element.href;
                const idMatch = href.match(/[?&]id=(\d+)/i); // 假设ID是数字，根据实际情况修改正则
                if (idMatch) {
                    const id = idMatch[1];
                    const name = element.querySelector('b')?.title || '';
                    data.push([id, name]);
                }
            });
            const name = iframeDocument.querySelector("#artist-name")?.textContent
            let fileName = getFileNameFromURL() || 'songs.csv';
            if (name){
                fileName = name + "_" + fileName
            }
            downloadCSV(data, fileName);
        });
    }

    if(document.readyState === "complete" || (document.readyState !== "loading" && !document.documentElement.doScroll)) {
        main();
    } else {
        document.addEventListener("DOMContentLoaded", main);
    }

    function getFileNameFromURL() {
        // 获取当前页面的完整URL
        const href = window.location.href;

        // 使用正则表达式从整个URL中匹配纯数字的id参数
        // 这个正则表达式会匹配 '?id=数字'、'&id=数字' 或 '#...&id=数字' 等模式
        // 假设id是一串数字，且紧跟在'id='之后
        const match = href.match(/(?:[?&]id=)(\d+)/i);

        // 如果匹配成功，返回以ID值命名的文件名，否则返回null
        return match ? `${match[1]}.csv` : null;
    }

    function downloadCSV(rows, fileName) {
        const csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click(); // Trigger download
        document.body.removeChild(link); // Clean up
    }
})();