// ==UserScript==
// @name         Extract Aws Ip Data
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  获取出AWS中所有的EC2 IP地址
// @author       23233
// @match        https://console.amazonaws.cn/ec2/home?region=cn-north-1
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazonaws.cn
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Create button
    const button = document.createElement("button");
    button.innerHTML = "Extract Data";
    button.style.position = "fixed";
    button.style.bottom = "10px";
    button.style.right = "10px";
    button.style.zIndex = "9999";

    // Append to body
    document.body.appendChild(button);

    // Add click event listener
    button.addEventListener("click", function() {
             // Initialize an empty array to hold the cell values
        const cellValues = [];

        // Get the first iframe element
        const iframe = document.querySelector("iframe");

        // Get the iframe's document object
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

        // Get tbody element inside iframe
        const tbody = iframeDoc.querySelector("tbody");

        // Check if tbody exists
        if (!tbody) {
            alert("No tbody found");
            return;
        }

        // Get all rows
        const rows = tbody.querySelectorAll("tr");

        // Loop through each row
        rows.forEach((row) => {
            // Get all cells in this row
            const cells = row.querySelectorAll("td");

            // Get the 10th cell
            const tenthCell = cells[9];

            // Check if the 10th cell exists
            if (tenthCell) {
                // Add its text content to the array, wrapped in double quotes
                cellValues.push(`${tenthCell.textContent.trim()}`);
            }
        });

        // Convert the array to a comma-separated string
        const cellValuesStr = cellValues.join(",");

        // Copy the string to clipboard
        navigator.clipboard.writeText(cellValuesStr).then(() => {
            alert("Data copied to clipboard");
        }).catch((err) => {
            alert("Failed to copy data: " + err);
        });
    });

})();