# 更新与 `_notice`

lark-cli 命令执行后，如果检测到新版本，JSON 输出中会包含 `_notice.update` 字段（含 `message`、`command` 等）。

除非用户正在询问更新、版本或 notice，否则不要把 `_notice` 原样复制为当前任务的主要答案，也不要为了 notice 中断当前任务去反复查 help。

需要稳定 JSON 给脚本或机器读取时，可以在命令前设置：

```bash
LARKSUITE_CLI_NO_UPDATE_NOTIFIER=1 LARKSUITE_CLI_NO_SKILLS_NOTIFIER=1 <lark-cli command>
```

当你在输出中看到 `_notice.update` 时，先完成用户当前请求；如仍相关，再简短告知可运行：

```bash
lark-cli update --help
```

若 help 包含 `--skip-skills`，设置 `LARKSUITE_CLI_NO_SKILLS_SYNC=1` 后运行 `lark-cli update`；否则使用 `npm install -g @larksuite/cli@latest`。两条路径保留 binary 更新且不安装官方独立 skills。仅在明确需要同步官方 Skills 时运行 `lark-cli update --skip-skills=false`。

`--skip-skills` 不与 `--skills-layout` 同用。配置了 distribution manifest 时，更新是 binary 和 Skills 的原子事务；仅在已通过参数或环境变量启用跳过同步时，才需显式设置 `--skip-skills=false`，`--check` 仍只读。

另外两类 notice：
- `_notice.skills`：本地 Skills 与当前 CLI 不同步。
- `_notice.deprecated_command`：本次使用了兼容保留的旧命令；后续调用改用 `replacement`。如果同时提供 `action: "lark-cli update"`，同样建议升级。
