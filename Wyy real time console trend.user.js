// ==UserScript==
// @name         网易云音乐实时歌曲趋势播放量统计
// @namespace    http://tampermonkey.net/
// @version      0.2
// @author       23233
// @description  拦截指定 URL 请求，计算今日和昨日的播放量总和，并在控制台输出结果
// @match        *://st.music.163.com/*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';
    let yestodayCount = 0
    let nowCount = 0
    // 拦截 Fetch API
    var originalFetch = unsafeWindow.fetch;

    window.unsafeWindow.fetch = (url, options) => {
        return originalFetch(url, options).then(async (response) => {
            if(url.includes("/weapi/push-song-advisor/open/api/data-service/advisor/real_time_song_trend")){
                return response.clone().json().then(function(data) {
                    processData(data.data);
                    return response;
                });
            }
            if(url.includes("/api/push-song-advisor/open/api/data-service/advisor/real_time_song_list")){
                return response.clone().json().then(function(data) {
                    processToday(data.data);
                    return response;
                });
            }
            return response;

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

        yestodayCount += yesterday_total
        nowCount += today_total

        console.log("今日播放量总和：" + today_total);
        console.log("昨日播放量总和：" + yesterday_total);
        console.log("今日累加总量：" + nowCount);
        console.log("昨日累加总量：" + yestodayCount);
    }

    function processToday(data) {
        // 初始化today_play_cnt和yesterday_play_cnt的累加值
        let todayTotal = 0;
        let yesterdayTotal = 0;

        // 如果data不是一个有效对象，或data.data不是一个数组，直接返回
        if (!data || !Array.isArray(data.data)) {
            console.log("Invalid input");
            return;
        }

        // 遍历data.data数组，累加today_play_cnt和yesterday_play_cnt
        data.data.forEach(item => {
            if (item?.today_play_cnt) {
                todayTotal += item.today_play_cnt;
            }
            if (item?.yesterday_play_cnt) {
                yesterdayTotal += item.yesterday_play_cnt;
            }
        });

        // 输出累加结果
        console.log(`今天的播放总次数: ${todayTotal}`);
        console.log(`昨天的播放总次数: ${yesterdayTotal}`);
    }

})();
