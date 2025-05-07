# Changelog

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