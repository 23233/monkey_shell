// ==UserScript==
// @name         Instagram API Data Exporter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Intercept Instagram GraphQL API responses and export data to CSV
// @author       23233
// @match        https://www.instagram.com/*
// @grant        unsafeWindow
// @grant        GM_download
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let dataToExport = [];

    // Intercept XHR requests
    const originalOpen = unsafeWindow.XMLHttpRequest.prototype.open;
    unsafeWindow.XMLHttpRequest.prototype.open = function(method, url) {
        this.addEventListener('load', function() {
            if (url.includes('/api/graphql') || url.includes('/graphql/query')) {
                try {
                    const response = JSON.parse(this.responseText);

                    // Check for the first type of data structure
                    const edges1 = response?.data?.xdt_api__v1__feed__user_timeline_graphql_connection?.edges;
                    if (edges1 && Array.isArray(edges1)) {
                        edges1.forEach(edge => {
                            const node = edge.node;
                            const id = node.id;
                            const ownerId = node.owner.id;
                            const videoUrl = node.video_versions?.[0]?.url;
                            if (id && ownerId && videoUrl) {
                                dataToExport.push({
                                    id: id,
                                    ownerId: ownerId,
                                    videoUrl: videoUrl
                                });
                            }
                        });
                    }

                    // Check for the second type of data structure
                    const edges2 = response?.data?.xdt_api__v1__clips__user__connection_v2?.edges;
                    if (edges2 && Array.isArray(edges2)) {
                        edges2.forEach(edge => {
                            const node = edge.node.media;
                            const id = node.id;
                            const ownerId = node.user.id;
                            const videoUrl = node.video_versions?.[0]?.url;
                            if (id && ownerId && videoUrl) {
                                dataToExport.push({
                                    id: id,
                                    ownerId: ownerId,
                                    videoUrl: videoUrl
                                });
                            }
                        });
                    }

                    updateButton();
                } catch (e) {
                    console.error('Error parsing response:', e);
                }
            }
        });
        originalOpen.apply(this, arguments);
    };

    // Create a floating button
    const button = document.createElement('button');
    button.style.position = 'fixed';
    button.style.bottom = '10px';
    button.style.right = '10px';
    button.style.zIndex = '1000';
    button.style.padding = '10px';
    button.style.backgroundColor = '#007bff';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.innerText = 'Export Feed';

    window.addEventListener('load', ()=>{
        document.body.appendChild(button);
    })


    button.addEventListener('click', () => {
        if (dataToExport.length > 0) {
            const ownerId = dataToExport[0].ownerId;
            const timestamp = Date.now();
            const csv = Papa.unparse(dataToExport);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            saveAs(blob, `${ownerId}_${dataToExport.length}_${timestamp}.csv`);
        }
    });

    function updateButton() {
        button.innerText = dataToExport.length > 0 ? `Export Feed (${dataToExport.length})` : 'Export Feed';
    }

})();
