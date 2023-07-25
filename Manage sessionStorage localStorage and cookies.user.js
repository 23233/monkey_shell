// ==UserScript==
// @name         Manage sessionStorage localStorage and cookies
// @namespace    https://github.com/23233/monkey_shell
// @version      0.2
// @description  若要启用GM_cookie 需要Beta版本的tampermonkey 否则只支持document.cookie
// @author       23233
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_cookie
// ==/UserScript==

(function() {
    'use strict';

    // Create a floating gear button
    var button = document.createElement('button');
    button.innerHTML = '&#9881;';
    button.style.position = 'fixed';
    button.style.bottom = '65px';
    button.style.right = '10px';
    button.style.zIndex = '9999';
    button.style.fontSize = '24px'
    document.body.appendChild(button);

    // Create a popup layer
    var popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.bottom = '95px';
    popup.style.right = '10px';
    popup.style.background = '#fff';
    popup.style.border = '1px solid #000';
    popup.style.padding = '10px';
    popup.style.display = 'none';
    popup.style.width = '300px';
    popup.style.zIndex = '9999';
    document.body.appendChild(popup);

    // Create tabs
    var tabs = ['sessionStorage', 'localStorage', 'cookies'];
    var tabDivs = {};
    var textareas = {};
    var getButtons = {};
    var setButtons = {};

    var tabButtonDiv = document.createElement('div');
    tabButtonDiv.style.display = 'flex';
    tabButtonDiv.style.justifyContent = 'space-between';
    tabButtonDiv.style.flexWrap = 'wrap';
    tabButtonDiv.style.gap = '2px';
    popup.appendChild(tabButtonDiv);

    tabs.forEach(function(tab) {
        var tabButton = document.createElement('button');
        tabButton.textContent = tab;
        tabButton.style.fontSize = '14px'
        tabButtonDiv.appendChild(tabButton);

        var div = document.createElement('div');
        div.style.display = 'none';
        popup.appendChild(div);
        tabDivs[tab] = div;

        var textarea = document.createElement('textarea');
        textarea.style.width = '100%';
        textarea.style.height = '200px';
        div.appendChild(textarea);
        textareas[tab] = textarea;

        var buttonDiv = document.createElement('div');
        buttonDiv.style.display = 'flex';
        buttonDiv.style.justifyContent = 'space-between';
        div.appendChild(buttonDiv);

        var setButton = document.createElement('button');
        setButton.textContent = 'Set';
        buttonDiv.appendChild(setButton);
        setButtons[tab] = setButton;

        var getButton = document.createElement('button');
        getButton.textContent = 'Get';
        buttonDiv.appendChild(getButton);
        getButtons[tab] = getButton;

        // Tab button click event
        tabButton.addEventListener('click', function() {
            tabs.forEach(function(otherTab) {
                tabDivs[otherTab].style.display = otherTab === tab ? 'block' : 'none';
            });
            if (tab === 'cookies') {
                getCookies(function(data) {
                    textareas[tab].value = data;
                });
            } else {
                var data = getStorageAsJson(window[tab]);
                textareas[tab].value = data;
            }
        });
    });

    // Function to get cookies
    function getCookies(callback) {
        GM_cookie.list({}, function(cookies, error) {
            if (!error) {
                var data = cookies.map(cookie => cookie.name + '=' + cookie.value).join('; ');
                callback(data);
            } else {
                console.warn("GM_cookie不受支持 回退到document.cookie 无法获取到httpOnly的key")
                callback(document.cookie);
            }
        });
    }

    // Function to set cookies
    function setCookies(data) {
        var cookies = data.split('; ');
        cookies.forEach(function(cookie) {
            var parts = cookie.split('=');
            GM_cookie.set({
                url: window.location.href,
                name: parts[0],
                value: parts[1]
            }, function(error) {
                if (error) {
                    console.warn("GM_cookie不受支持 回退到document.cookie 无法获取到httpOnly的key")
                    document.cookie = parts[0] + '=' + parts[1];
                }
            });
        });
    }

    // Function to get storage as JSON
    function getStorageAsJson(storage) {
        var json = {};
        for (var i = 0; i < storage.length; i++) {
            var key = storage.key(i);
            var value = storage.getItem(key);
            json[key] = value;
        }
        return JSON.stringify(json, null, 2);
    }

    // Function to set storage from JSON
    function setStorageFromJson(storage, json) {
        var obj = JSON.parse(json);
        for (var key in obj) {
            storage.setItem(key, obj[key]);
        }
    }

    // Button click event
    button.addEventListener('click', function() {
        popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
    });

    // Get and set button click events
    tabs.forEach(function(tab) {
        getButtons[tab].addEventListener('click', function() {
            if (tab === 'cookies') {
                getCookies(function(data) {
                    GM_setClipboard(data);
                    textareas[tab].value = data;
                });
            } else {
                var data = getStorageAsJson(window[tab]);
                GM_setClipboard(data);
                textareas[tab].value = data;
            }
        });

        setButtons[tab].addEventListener('click', function() {
            var data = textareas[tab].value;
            if (tab === 'cookies') {
                setCookies(data);
            } else {
                setStorageFromJson(window[tab], data);
            }
        });
    });
})();
