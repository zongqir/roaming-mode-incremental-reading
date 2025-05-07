[中文](README_zh_CN.md)

# Roaming Mode Incremental Reading

<img src="./icon.png" width="160" height="160" alt="icon">

The core principle of incremental reading is intelligent recommendation for "read later", not combating forgetting. Combating forgetting is the core of reviewing flashcards.

## Project Information

- **Project Repository**: [https://github.com/ebAobS/roaming-mode-incremental-reading](https://github.com/ebAobS/roaming-mode-incremental-reading)
- **Based on**: [siyuan-plugin-random-doc](https://github.com/terwer/siyuan-plugin-random-doc.git) (Author: [terwer](https://github.com/terwer))

## Preview

![preview.png](./preview.png)

## Core Philosophy

Incremental reading should be distinguished from flashcards:

- **Flashcards** review algorithm is based on **forgetting curves**, for which SiYuan's flashcard system with FSRS algorithm is already sufficient. Years of experience with Anki and SuperMemo teach us that the ["minimum information principle"](https://www.kancloud.cn/ankigaokao/incremental_learning/2454060#_30) is crucial.
- **Incremental reading** deals with large texts that inherently don't meet the ["minimum information principle"](https://www.kancloud.cn/ankigaokao/incremental_learning/2454060#_30). Most incremental reading solutions instinctively use forgetting curve-based algorithms (like FSRS) to recommend articles for review, which I personally don't find appropriate.

For a lengthy article, it's difficult to use **memory level alone** as the standard for whether it should be **recommended for review**. The real **standard should be multidimensional**, including difficulty, learning progress, importance of learning content, urgency, level of interest, etc.

That's why I developed this plugin, allowing users to **customize article parameters** and their weights (e.g., article difficulty, weight 30%), and then calculate these indicators into an article's **priority**. Priority correlates positively with the probability of being recommended for review. Through a roulette wheel algorithm, based on priority, the next article is randomly recommended, thus achieving an informed roaming of articles. I believe this approach allows incremental reading to return to its essence — implementing pressure-free "read later" to efficiently learn large amounts of material.

**In summary, the core purpose of incremental reading is not "combating forgetting," but implementing pressure-free "read later" to efficiently learn large amounts of material simultaneously.**

Related reading: [Progressive Learning: SuperMemo's Algorithm Implementation for Progressive Reading](https://zhuanlan.zhihu.com/p/307996163)

Following the principle of "Don't create entities unnecessarily", the "extracting" and "card-making" functions of incremental reading are not included in this plugin. Clicking the "edit" button allows opening the article you're incrementally learning in a new tab. From there, you can use many other plugins in the SiYuan marketplace to implement subsequent processes like "extracting" and "card-making".

## Features

- User-defined article parameters and weights. Adjustable during incremental reading.
- Priority calculated from parameters. Higher priority means higher recommendation probability. Document recommendation based on roulette wheel algorithm.
- Support for notebook and root document filtering.
- Support for no algorithm. Completely random "one-pass" mode.

## Usage Guide

1. **Install Plugin**: Search for "Roaming Mode Incremental Reading" in the SiYuan plugin market and install
2. **Set Parameters**: Right-click the plugin icon, configure incremental mode, customize the indicators and weights you need.
3. **Start Incremental Reading**: Read and study the recommended articles, click the "edit" button to open in a new tab, and perform extraction, card-making and other operations.
4. **Adjust Parameters**: Use parameter adjustment instead of traditional incremental reading's "forget", "remember" buttons as feedback.
5. **Read Later**: When you're tired of this article, bored with reading, encounter difficulties and don't want to continue, whatever the reason, click "Continue Roaming" to intelligently recommend and read the next article.

## Improvement Plans

The roulette wheel algorithm based on priority doesn't seem very intelligent. Is it possible to use methods like deep learning to improve the intelligence of recommendations? Welcome everyone to give suggestions and secondary development.

## Update History

**v1.1.0 Update (2025.05.25)**
- Updated author information and copyright notices
- Added systematic hierarchy annotations for better code maintenance
- Standardized comment style for better readability
- Fixed email and project URL information

**v1.0.1 Update (2025.05.13)**
- Enhanced prompt messages with poetic expressions
- Improved help documentation links to GitHub repository

**v1.0.0 Major Update (2025.05.06)**
- First available version

For more update records, please check [CHANGELOG](https://github.com/ebAobS/roaming-mode-incremental-reading/blob/main/CHANGELOG.md)

## Acknowledgements

- Special thanks to [terwer](https://github.com/terwer) for developing the original [siyuan-plugin-random-doc](https://github.com/terwer/siyuan-plugin-random-doc.git), on which this plugin is based
- Thanks to [frostime](https://github.com/siyuan-note/plugin-sample-vite-svelte) for the project template

## Donate

If this plugin is helpful to you, feel free to buy me a cup of coffee! Your support encourages me to keep updating and creating more useful tools!

<div>
<img src="https://cdn.jsdelivr.net/gh/ebAobS/pics@main/donate.png" alt="donate" style="height:300px;" />
</div>

## Contact

Author Email: ebAobS@outlook.com