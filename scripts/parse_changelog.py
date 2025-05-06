import re
import shutil
from collections import defaultdict


def parse_changelog():
    """
    :robot: A new release will be created
    ---


    ## 1.0.0 (2025-05-06)


    ### Features

    * First available version of Incremental Reading
    * Added user-defined article parameters and weights
    * Added priority calculation based on parameters
    * Implemented roulette wheel algorithm for document recommendation
    * Added support for notebook and root document filtering
    * Added support for completely random "one-pass" mode
    """

    # will print

    """
    :robot: a new release will be created
    ---

    ## 1.0.0 (2025-05-06)
    ### Features
    * First available version of Incremental Reading
    * Added user-defined article parameters and weights
    * Added priority calculation based on parameters
    * Implemented roulette wheel algorithm for document recommendation
    * Added support for notebook and root document filtering
    * Added support for completely random "one-pass" mode
    """

    # make a backup copy of the original file
    original_file = 'CHANGELOG.md'
    # backup_file = original_file.replace(".md", "_backup.md")
    # shutil.copyfile(original_file, backup_file)

    # handle repeat lines
    with open(original_file, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f.readlines()]
    unique_commits = remove_same_commit(lines)

    # save new file
    save_file = original_file
    with open(save_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(unique_commits))
    print(f"comment parsed.saved to => {save_file}")


def remove_same_commit(commit_list):
    commit_map = defaultdict()
    for line in commit_list:
        if '#' not in line:
            line = line.lower()
        # 先匹配常规的
        match = re.search(r'(?<=\*\s).*?(?=\()', line)
        if match:
            title = match.group(0).strip()
            commit_map[title] = line
        else:
            # 接下来匹配有模块的
            match2 = re.search(r'[*] [**](.*)[**] ([^:]+): (.*) \((.*)\)', line)
            if match2:
                message_title = match.group(3).strip()
                commit_map[message_title] = line
            else:
                # 最后处理剩下的
                commit_map[line] = line

    return commit_map.values()


if __name__ == "__main__":
    parse_changelog()