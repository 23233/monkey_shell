// ==UserScript==
// @name         网易云音乐实时歌曲趋势播放量统计
// @namespace    http://tampermonkey.net/
// @version      0.1
// @author       23233
// @description  拦截指定 URL 请求，计算今日和昨日的播放量总和，并在控制台输出结果
// @match        *://st.music.163.com/*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // 拦截 Fetch API
    var originalFetch = unsafeWindow.fetch;

    window.unsafeWindow.fetch = (url, options) => {
        return originalFetch(url, options).then(async (response) => {
            if(url.includes("push-song-advisor/open/api/data-service/advisor/real_time_song_trend")){
                return response.clone().json().then(function(data) {
                    processData(data.data);
                    return response;
                });
            }else{
                return response;
            }
        });
    };


    // 处理数据的函数
    function processData(data) {
        var today_total = 0;
        var yesterday_total = 0;

        for (var i = 0; i < data.length; i++) {
            today_total += data[i].play_cnt_today || 0;
            yesterday_total += data[i].play_cnt_yesterday || 0;
        }

        console.log("今日播放量总和：" + today_total);
        console.log("昨日播放量总和：" + yesterday_total);
    }
})();
