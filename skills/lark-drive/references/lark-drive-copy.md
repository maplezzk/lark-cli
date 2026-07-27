
# drive +copy

> **前置条件：** 先阅读 [`../lark-shared/SKILL.md`](../../lark-shared/SKILL.md) 了解认证、全局参数和安全规则。

复制一个 Drive 文件（在线文档、表格、多维表格、幻灯片、思维笔记或普通文件）到目标文件夹，生成一个内容相同的新副本。推荐直接传文档 URL。

## 命令

```bash
# 推荐：源文档传 URL（自动识别类型和 token）
lark-cli drive +copy --url "https://example.larksuite.com/docx/<DOCX_TOKEN>" --name '副本名称' --folder-token <TARGET_FOLDER_TOKEN>
```

## 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `--url` | 与 `--token` 二选一 | 源文档 URL，支持 `doc` / `docx` / `sheet` / `file` / `mindnote` / `slides` / `base` / `bitable` 路径 |
| `--token` | 与 `--url` 二选一 | 源文档 token 或 URL；裸 token 必须配合 `--type` |
| `--type` | 裸 token 时必填 | 源文件类型：`doc`、`docx`、`sheet`、`file`、`mindnote`、`slides`、`bitable`（`base` 为兼容别名）；传 URL 时可省略，显式传入时必须与 URL 类型一致 |
| `--name` | 是 | 副本名称，最长 256 字节 |
| `--folder-token` | 是 | 目标文件夹 token、文件夹 URL，或常量 `my_space`（复制到当前身份"我的空间"根目录，内部自动解析根 token） |
| `--extra` | 否 | 可重复的 `key=value` 对，原样透传给 API 的 `extra` 自定义复制参数；典型用法 `--extra target_type=docx`（复制旧版 doc 时转换为 docx 副本） |

## 输入规则

- `--url` 与 `--token` 互斥，只传一个
- `--type` 必须与源文件真实类型一致，类型不匹配时服务端会返回失败
- `base` 与 `bitable` 是同一概念，CLI 会把 `base` 归一化为 `bitable` 后发给服务端
- 目标文件夹必须是云空间（云盘/云存储）文件夹 token，不能传 wiki 节点 token

## Wiki 场景

`drive +copy` 只复制云盘（Drive）文件，不接受 wiki URL / token；传入时返回校验错误，错误 hint 会给出替代命令。知识库内复制节点用 [`lark-wiki`](../../lark-wiki/SKILL.md) 的 `wiki +node-copy`；要把 wiki 文档复制成 Drive 空间里的独立副本（脱离知识库），先用 `drive +inspect` 解包拿到底层 `token` 和 `type`，再对底层 token 执行 `drive +copy`。

## 行为说明

- 该 shortcut 继承通用能力，可配合 `--as user|bot|auto`、`--format`、`--jq`、`--dry-run` 使用
- `--dry-run` 只输出请求方法、路径、身份和请求体预览，不会真正创建副本
- 这是写入操作；执行前应确认源文档和目标文件夹准确无误

## 输出

```json
{
  "copied": true,
  "file_token": "<new_file_token>",
  "file_type": "docx",
  "name": "副本名称",
  "url": "https://example.larksuite.com/docx/<new_file_token>",
  "source_file_token": "<source_file_token>",
  "source_type": "docx",
  "folder_token": "<target_folder_token>"
}
```

## 参考

- [lark-drive](../SKILL.md) -- 云空间（云盘/云存储）全部命令
- [lark-wiki](../../lark-wiki/SKILL.md) -- 知识库节点复制（`wiki +node-copy`）
- [lark-shared](../../lark-shared/SKILL.md) -- 认证和全局参数
