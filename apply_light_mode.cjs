const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Mapping for backgrounds
    content = content.replace(/\bbg-\[\#0F172A\](\/[0-9]+)?\b/g, (match, opacity) => `bg-slate-50${opacity||''} dark:${match}`);
    content = content.replace(/\bbg-\[\#1E293B\](\/[0-9]+)?\b/g, (match, opacity) => `bg-white${opacity||''} dark:${match}`);
    content = content.replace(/\bbg-slate-900(\/[0-9]+)?\b/g, (match, opacity) => `bg-slate-50${opacity||''} dark:${match}`);
    content = content.replace(/\bbg-slate-800(\/[0-9]+)?\b/g, (match, opacity) => `bg-white${opacity||''} dark:${match}`);
    content = content.replace(/\bbg-slate-700(\/[0-9]+)?\b/g, (match, opacity) => `bg-slate-100${opacity||''} dark:${match}`);
    
    // Mapping for borders
    content = content.replace(/\bborder-slate-800(\/[0-9]+)?\b/g, (match, opacity) => `border-slate-200${opacity||''} dark:${match}`);
    content = content.replace(/\bborder-slate-700(\/[0-9]+)?\b/g, (match, opacity) => `border-slate-300${opacity||''} dark:${match}`);
    content = content.replace(/\bborder-slate-600(\/[0-9]+)?\b/g, (match, opacity) => `border-slate-400${opacity||''} dark:${match}`);

    // Mapping for text
    // Replace text-slate-100 with text-slate-900 dark:text-slate-100
    content = content.replace(/\btext-slate-[12]00\b/g, match => `text-slate-900 dark:${match}`);
    content = content.replace(/\btext-slate-300\b/g, match => `text-slate-700 dark:${match}`);
    content = content.replace(/\btext-slate-400\b/g, match => `text-slate-600 dark:${match}`);

    // Be careful with text-white. If it's on a colored button, it might become text-slate-900.
    // Let's replace text-white with text-slate-900 dark:text-white UNLESS the string contains bg-emerald, bg-rose, bg-teal, bg-red, bg-yellow
    content = content.replace(/className=(["'`])(.*?)\1/g, (fullMatch, quote, classes) => {
        if (classes.match(/bg-(emerald|rose|teal|red|yellow|green|blue|indigo|purple|pink)-/)) {
            // It has a colored background, let's leave text-white alone
            return fullMatch;
        } else {
            // Replace text-white
            let newClasses = classes.replace(/\btext-white\b/g, 'text-slate-900 dark:text-white');
            return `className=${quote}${newClasses}${quote}`;
        }
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${path.basename(filePath)}`);
    }
}

function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) walk(file);
        else if (file.endsWith('.jsx') || file.endsWith('.js')) processFile(file);
    });
}

walk(srcDir);
console.log("Script executed.");
