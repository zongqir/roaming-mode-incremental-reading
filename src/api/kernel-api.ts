/*
 * Copyright (c) 2023, Terwer . All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Terwer designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Terwer in the LICENSE file that accompanied this code.
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
 * Please contact Terwer, Shenzhen, Guangdong, China, youweics@163.com
 * or visit www.terwer.space if you need additional information or have any
 * questions.
 */

import { BaseApi, SiyuanData } from "./base-api"
import { StrUtil } from "zhi-common"

/**
 * 思源笔记服务端API v2.8.9
 *
 * @see {@link https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md API}
 *
 * @author terwer
 * @version 0.0.1
 * @since 0.0.1
 */
class KernelApi extends BaseApi {
  /**
   * 列出笔记本
   */
  public async lsNotebooks(): Promise<SiyuanData> {
    return await this.siyuanRequest("/api/notebook/lsNotebooks", {})
  }

  /**
   * 分页获取根文档
   *
   * @param keyword - 关键字
   * @deprecated
   */
  public async getRootBlocksCount(keyword?: string): Promise<number> {
    const stmt = `SELECT COUNT(DISTINCT b.root_id) as count FROM blocks b`
    const data = (await this.sql(stmt)).data as any[]
    return data[0].count
  }

  /**
   * 以id获取思源块信息
   * @param blockId 块ID
   */
  public async getBlockByID(blockId: string): Promise<any> {
    const stmt = `select *
                from blocks
                where id = '${blockId}'`
    const data = (await this.sql(stmt)).data as any[]
    if (!data || data.length === 0) {
      throw new Error("通过ID查询块信息失败")
    }
    return data[0]
  }

  /**
   * 获取随机文档
   *
   * @param notebookId
   */
  public async getRandomRootBlocks(notebookId?: string): Promise<SiyuanData> {
    const condition = StrUtil.isEmptyString(notebookId) ? "" : `and box = '${notebookId}'`
    const stmt = `SELECT DISTINCT b.root_id, b.content FROM blocks b 
    WHERE 1=1 ${condition}
    ORDER BY random() LIMIT 1`
    this.logger.info("random sql =>", stmt)
    return await this.sql(stmt)
  }

  /**
   * 获取自定义SQL随机文档
   *
   * @param sql
   */
  public async getCustomRandomDocId(sql: string): Promise<SiyuanData> {
    this.logger.info("custom random sql =>", sql)
    return await this.sql(sql)
  }

  /**
   * 获取块属性
   */
  public async getBlockAttrs(blockId: string): Promise<SiyuanData> {
    return await this.siyuanRequest("/api/attr/getBlockAttrs", {
      id: blockId,
    })
  }

  /**
   * 设置块属性
   */
  public async setBlockAttrs(blockId: string, attrs: any): Promise<SiyuanData> {
    return await this.siyuanRequest("/api/attr/setBlockAttrs", {
      id: blockId,
      attrs: attrs,
    })
  }

  public async getDoc(docId: string): Promise<SiyuanData> {
    const params = {
      id: docId,
      isBacklink: false,
      mode: 0,
      size: 128,
    }
    const url = "/api/filetree/getDoc"
    return await this.siyuanRequest(url, params)
  }

  /**
   * 获取最近更新的文档
   * @returns 最近更新的文档列表
   */
  public async getRecentDocs(): Promise<SiyuanData> {
    return await this.siyuanRequest("/api/storage/getRecentDocs", {})
  }

  /**
   * 更新块内容
   * @param blockId 块ID
   * @param content 新内容
   * @param dataType 数据类型，默认为markdown
   */
  public async updateBlock(blockId: string, content: string, dataType: string = "markdown"): Promise<SiyuanData> {
    return await this.siyuanRequest("/api/block/updateBlock", {
      id: blockId,
      dataType: dataType,
      data: content,
    })
  }

  /**
   * 获取文档的Markdown内容
   * @param docId 文档ID
   * @returns 文档的Markdown内容
   */
  public async getDocMarkdown(docId: string): Promise<string> {
    try {
      // 使用SQL查询获取文档的所有块内容
      const stmt = `
        SELECT content 
        FROM blocks 
        WHERE root_id = '${docId}' 
        AND type != 'd' 
        ORDER BY created
      `
      const result = await this.sql(stmt)
      if (result.code !== 0) {
        throw new Error(result.msg)
      }
      
      const blocks = result.data as any[]
      if (!blocks || blocks.length === 0) {
        return ""
      }
      
      // 将所有块的内容合并为Markdown
      const markdownContent = blocks
        .map(block => block.content)
        .filter(content => content && content.trim())
        .join('\n\n')
      
      return markdownContent
    } catch (error) {
      this.logger.error("获取文档Markdown内容失败:", error)
      throw error
    }
  }

  /**
   * 获取指定笔记本下的文档树
   * @param notebookId 笔记本ID，如果为空则获取所有笔记本
   * @param path 路径，用于获取子目录
   * @returns 文档树结构
   */
  public async getFileTree(notebookId?: string, path?: string): Promise<SiyuanData> {
    try {
      const params: any = {}
      if (notebookId) {
        params.notebook = notebookId
      }
      if (path) {
        params.path = path
      }
      return await this.siyuanRequest("/api/filetree/listDocsByPath", params)
    } catch (error) {
      this.logger.error("获取文件树失败:", error)
      throw error
    }
  }

  /**
   * 获取笔记本下的根文档列表
   * @param notebookId 笔记本ID  
   * @returns 根文档列表
   */
  public async getRootDocs(notebookId: string): Promise<SiyuanData> {
    try {
      // 先测试简单查询，看看该笔记本下有多少文档
      const testStmt = `
        SELECT id, content as title, path 
        FROM blocks 
        WHERE type = 'd' 
        AND box = '${notebookId}'
        ORDER BY updated DESC
        LIMIT 1
        
      `
      this.logger.info(`测试查询笔记本 ${notebookId} 下的文档:`, testStmt)
      const testResult = await this.sql(testStmt)
      this.logger.info(`测试结果:`, testResult)
      
      // 如果测试查询有结果，再尝试根文档查询
      if (testResult.data && testResult.data.length > 0) {
        // 修改根文档查询逻辑 - 查找路径层级较浅的文档
        const stmt = `
          SELECT id, content as title, path 
          FROM blocks 
          WHERE type = 'd' 
          AND box = '${notebookId}'
          AND content IS NOT NULL 
          AND content != ''
          ORDER BY length(path), updated DESC
          LIMIT 200
        `
        this.logger.info(`根文档查询:`, stmt)
        return await this.sql(stmt)
      } else {
        this.logger.warn(`笔记本 ${notebookId} 下没有找到任何文档`)
        return { code: 0, msg: "", data: [] }
      }
    } catch (error) {
      this.logger.error("获取根文档列表失败:", error)
      throw error
    }
  }

  /**
   * 根据文档ID获取文档标题
   * @param docId 文档ID
   * @returns 文档标题
   */
  public async getDocTitleById(docId: string): Promise<string> {
    try {
      const stmt = `
        SELECT content as title 
        FROM blocks 
        WHERE type = 'd' 
        AND id = '${docId}'
        LIMIT 1
      `
      const result = await this.sql(stmt)
      
      if (result.code !== 0 || !result.data || result.data?.length === 0) {
        return "(未找到文档)"
      }

      return result.data[0].title || "(无标题)"
    } catch (error) {
      this.logger.error("获取文档标题失败:", error)
      return "(获取失败)"
    }
  }
}

export default KernelApi
