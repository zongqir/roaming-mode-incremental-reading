[中文](README_zh_CN.md)

# Roaming Mode Incremental Reading

<img src="./icon.png" width="160" height="160" alt="icon">

The core principle of incremental reading is intelligent recommendation for "read later", not combating forgetting. Combating forgetting is the core of reviewing flashcards.

## Welcome to add WeChat: ebAobS, join the WeChat discussion group

## Project Information

- **Based on**: [siyuan-plugin-random-doc](https://github.com/terwer/siyuan-plugin-random-doc.git) (Author: [terwer](https://github.com/terwer))
- **Project Repository**: [https://github.com/ebAobS/roaming-mode-incremental-reading](https://github.com/ebAobS/roaming-mode-incremental-reading)
- **Discussion Thread**: [Roaming Mode Incremental Reading](https://ld246.com/article/1746802777105) 

## Interface Preview

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
2. **Set Parameters**: Right-click the plugin icon in the top bar to access the settings page, customize the indicators and weights you need.
3. **Start Incremental Reading**: Read and study the recommended articles, click the "edit" button to open in a new tab, and perform extraction, card-making and other operations.
4. **Adjust Parameters**: Use parameter adjustment instead of traditional incremental reading's "forget", "remember" buttons as feedback.
5. **Read Later**: When you're tired of this article, bored with reading, encounter difficulties and don't want to continue, whatever the reason, click "Continue Roaming" to intelligently recommend and read the next article.

## Improvement Plans

The roulette wheel algorithm based on priority doesn't seem very intelligent. Is it possible to use methods like deep learning to improve the intelligence of recommendations? Welcome everyone to give suggestions and secondary development. Also welcome to discuss incremental learning related experiences.

## Update History

**v1.2.1 Update (2025.07.07)**
- Added setting option: Automatically reset visited document records each time SiYuan is started

**v1.2.0 Update (2025.07.06)**
- For specific documents, they can be opened in the incremental reading page. Usage: browse the document first, then click the top bar plugin button to jump
- Removed read-only mode in incremental reading page, allowing simple editing
- Changed the step size of metric parameter adjustment buttons from 0.1 to 1
- Notebook selection supports multi-selection and free combination

**v1.1.1 Update (2025.05.12)**
- Fixed incorrect display of remaining document count in one-pass mode
- Optimized calculation of remaining document count in custom SQL mode

**v1.1.0 Update (2025.05.08)**
- Improved stability of the priority-based roulette wheel recommendation algorithm
- Added prompt information when calculating probability
- Modified the settings page, right-click the top bar plugin icon to enter the settings page
- Set the default value of all document indicators to 5
- Added actions to update all documents when modifying indicator information to ensure indicator values are not 0
- When viewing document indicator information, automatically corrects indicators with 0 or empty values to default value 5
- Added roaming history viewing function

**v1.0.1 Update (2025.05.07)**
- Enhanced prompt messages with poetic expressions
- Improved help documentation links to GitHub repository

**v1.0.0 Major Update (2025.05.06)**
- First available version

For more update records, please check [CHANGELOG](https://github.com/ebAobS/roaming-mode-incremental-reading/blob/main/CHANGELOG.md)

## Acknowledgements

- Special thanks to [terwer](https://github.com/terwer) for developing the original [siyuan-plugin-random-doc](https://github.com/terwer/siyuan-plugin-random-doc.git), on which this plugin is based
- Thanks to [frostime](https://github.com/siyuan-note/plugin-sample-vite-svelte) for the project template

## Donate

If this plugin is helpful to you, feel free to buy me lunch with a chicken leg! Thank you boss! Wish you good appetite, smooth sailing in everything, and money so much you can't count it all! Smooth wind, smooth water, smooth wealth!

<div>
<img src="https://cdn.jsdelivr.net/gh/ebAobS/pics@main/donate.png" alt="donate" style="height:300px;" />
</div>

## Contact

Author Email: ebAobS@outlook.com