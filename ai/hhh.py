with open('readme.md', 'r', encoding='utf-8') as fin, open('readme1.md', 'w', encoding='utf-8') as fout:
    for line in fin:
        if line.startswith('#'):
            fout.write(line[1:])  # 去掉开头的 #
        else:
            fout.write(line)
