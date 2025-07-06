/*
 * Copyright (c) 2025, ebAobS . All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  ebAobS designates this
 * particular file as subject to the "Classpath" exception as provided
 * by ebAobS in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact ebAobS, ebAobs@outlook.com
 * or visit https://github.com/ebAobS/roaming-mode-incremental-reading if you need additional information or have any
 * questions.
 */

/**
 * 文档工具类
 */
class PageUtil {
  /**
   * 获取最近打开的文档ID
   * @param pluginInstance 插件实例
   * @returns 最近打开的文档ID，如果没有则返回空字符串
   */
  public static async getRecentDocId(pluginInstance: any): Promise<string> {
    try {
      pluginInstance.logger.info("开始调用getRecentDocs API...")
      
      // 调用思源API获取最近更新的文档
      const response = await pluginInstance.kernelApi.getRecentDocs()
      
      pluginInstance.logger.info("getRecentDocs API响应:", response)
      
      if (response && response.code === 0 && response.data && response.data.length > 0) {
        // 返回第一个（最近更新的）文档的ID
        const recentDoc = response.data[0]
        pluginInstance.logger.info(`获取到最近文档: ${recentDoc.title} (${recentDoc.rootID})`)
        return recentDoc.rootID
      } else {
        pluginInstance.logger.warn("获取最近文档失败或没有最近文档", {
          response: response,
          hasResponse: !!response,
          code: response?.code,
          hasData: !!response?.data,
          dataLength: response?.data?.length
        })
        return ""
      }
    } catch (error) {
      pluginInstance.logger.error("调用getRecentDocs API失败:", error)
      return ""
    }
  }

  /**
   * 获取当前页面ID，带重试机制（保留作为备用方案）
   * @param retryCount 重试次数，默认3次
   * @param delay 重试延迟，默认100ms
   */
  public static async getPageId(retryCount: number = 3, delay: number = 100): Promise<string> {
    for (let i = 0; i < retryCount; i++) {
      const pageId = this.getPageIdSync()
      if (pageId) {
        return pageId
      }
      
      // 如果不是最后一次重试，则等待后重试
      if (i < retryCount - 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    return ""
  }

  /**
   * 同步获取当前页面ID（保留作为备用方案）
   */
  public static getPageIdSync(): string {
    // 2. 兼容旧逻辑：用DOM查找
    try {
      // 查找所有可见的protyle元素
      const protyleElements = document.querySelectorAll("div.protyle:not(.fn__none)")
      
      for (const protyleElement of protyleElements) {
        const protyleTitleElement = protyleElement.querySelector("div.protyle-title")
        if (protyleTitleElement && protyleTitleElement.hasAttribute("data-node-id")) {
          const nodeId = protyleTitleElement.getAttribute("data-node-id")
          if (nodeId) {
            return nodeId
          }
        }
      }
      
      // 如果上面的方法都找不到，尝试查找任何有data-node-id的protyle-title
      const anyTitleElement = document.querySelector("div.protyle-title[data-node-id]")
      if (anyTitleElement && anyTitleElement.hasAttribute("data-node-id")) {
        const nodeId = anyTitleElement.getAttribute("data-node-id")
        if (nodeId) {
          return nodeId
        }
      }
    } catch (e) {
      // 忽略DOM查询异常
    }
    
    return ""
  }
}

export default PageUtil
