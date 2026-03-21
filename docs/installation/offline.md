# Offline Installation

For offline installation, you need to download the correct binary for your system and architecture from the [releases page](https://github.com/MatinDehghanian/filebrowser/releases).

1.  Go to the [releases page](https://github.com/MatinDehghanian/filebrowser/releases) and find the latest release.
2.  In the "Assets" section, find the archive that matches your operating system and architecture. For example, if you are on a 64-bit Linux system, you would download `filebrowser_linux_amd64.tar.gz`.
3.  Upload the downloaded archive to your server using SFTP or any other method.
4.  SSH into your server and extract the archive:

    ```bash
    tar -xvf filebrowser_linux_amd64.tar.gz
    ```

5.  Move the `filebrowser` binary to a directory in your `$PATH`, for example `/usr/local/bin`:

    ```bash
    sudo mv filebrowser /usr/local/bin/
    ```

6.  You can now run filebrowser by typing `filebrowser` in your terminal.
