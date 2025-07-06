# Changelog

## [1.2.0] (2025-07-06)

### Features
* 针对特定文档，可以将其在渐进阅读页面打开，使用方法：先浏览该文档，再点击顶栏插件按钮即可跳转
* 渐进阅读页面取消了只读，可简单编辑的功能
* 将指标参数加减按钮跨度由0.1改为了1
* 笔记本选择可多选，可自由组合

## [1.1.1] (2025-05-12)

### Bug Fixes
* 修复了一遍过模式下显示剩余文档数量不正确的问题
* 优化了自定义SQL模式下的剩余文档数量计算方式

## [1.1.0] (2025-05-08)

### Enhancement
* 提高了机遇优先级的轮盘赌推荐算法稳定性
* 增加了计算概率时的提示信息
* 更改了设置页面，右键顶栏插件图标即可进入设置页面
* 设定了所有文档指标默认值为5
* 修改指标信息时增加了为所有文档更新的动作，确保指标值不为0
* 查看文档指标信息时，出现为0或者空值的指标，自动修正为默认值5
* 增加了漫游历史查看功能

## [1.0.1] (2025-05-07)

### Enhancement
* 美化提示信息，增加诗意表达
* 改进帮助文档链接，指向GitHub仓库中文文档

## [1.0.0] (2025-05-06)

### Features
* First available version of Incremental Reading
* Added user-defined article parameters and weights
* Added priority calculation based on parameters
* Implemented roulette wheel algorithm for document recommendation
* Added support for notebook and root document filtering
* Added support for completely random "one-pass" mode