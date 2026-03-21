<p align="center">
  <img src="https://raw.githubusercontent.com/MatinDehghanian/filebrowser/master/branding/banner.png" width="550"/>
</p>

[![Build](https://github.com/MatinDehghanian/filebrowser/actions/workflows/ci.yaml/badge.svg)](https://github.com/MatinDehghanian/filebrowser/actions/workflows/ci.yaml)
[![Go Report Card](https://goreportcard.com/badge/github.com/MatinDehghanian/filebrowser/v2)](https://goreportcard.com/report/github.com/MatinDehghanian/filebrowser/v2)
[![Version](https://img.shields.io/github/release/MatinDehghanian/filebrowser.svg)](https://github.com/MatinDehghanian/filebrowser/releases/latest)

File Browser provides a file managing interface within a specified directory and it can be used to upload, delete, preview and edit your files. It is a **create-your-own-cloud**-kind of software where you can just install it on your server, direct it to a path and access your files through a nice web interface.

## Installation

There are several ways to install File Browser.

### Online Installation (from GitHub)

You can install File Browser with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/MatinDehghanian/filebrowser/master/install.sh | bash
```

or

```bash
wget -qO- https://raw.githubusercontent.com/MatinDehghanian/filebrowser/master/install.sh | bash
```

This script will download and install the latest version of File Browser to `/usr/local/bin`.

### Offline Installation

For offline installation, please refer to the [offline installation documentation](docs/installation/offline.md).

### Docker

You can also use Docker to run File Browser:

```bash
docker run -d \
  -v /path/to/your/files:/srv \
  -v /path/to/your/database.db:/database.db \
  -p 8080:80 \
  filebrowser/filebrowser
```

### Reverse Proxy with Nginx and SSL (Let's Encrypt)

It is recommended to run File Browser behind a reverse proxy like Nginx and secure it with an SSL certificate. Here is an example configuration for Nginx:

1.  **Install Nginx and Certbot:**

    ```bash
    sudo apt update
    sudo apt install nginx python3-certbot-nginx
    ```

2.  **Configure Nginx:**

    Create a new Nginx configuration file at `/etc/nginx/sites-available/filebrowser`:

    ```nginx
    server {
        listen 80;
        server_name your-domain.com;

        location / {
            proxy_pass http://localhost:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```

3.  **Enable the new configuration:**

    ```bash
    sudo ln -s /etc/nginx/sites-available/filebrowser /etc/nginx/sites-enabled/
    ```

4.  **Obtain an SSL certificate from Let's Encrypt:**

    ```bash
    sudo certbot --nginx -d your-domain.com
    ```

    Certbot will automatically update your Nginx configuration to use SSL.

5.  **Restart Nginx:**

    ```bash
    sudo systemctl restart nginx
    ```

You should now be able to access File Browser at `https://your-domain.com`.

## Post-Installation

After installing File Browser, here are the next steps to get it running.

### First Run

To run File Browser for the first time, simply execute the command:

```bash
filebrowser
```

By default, it will listen on port `8080`. You can access it at `http://localhost:8080`. The default username and password are `admin` and `admin`.

You can specify a different port with the `-p` flag:

```bash
filebrowser -p 8888
```

### Configuration

File Browser can be configured using a configuration file or command-line flags. The default configuration file is `.filebrowser.json` in the same directory as the binary.

For a full list of available commands and flags, you can run:

```bash
filebrowser --help
```

### Running as a Service (systemd)

To run File Browser as a service on a Linux system with systemd, you can create a service file at `/etc/systemd/system/filebrowser.service`:

```
[Unit]
Description=File Browser
After=network.target

[Service]
User=your-user
Group=your-group
ExecStart=/usr/local/bin/filebrowser -c /etc/filebrowser/.filebrowser.json
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Remember to replace `your-user` and `your-group` with the appropriate user and group.

Then, enable and start the service:

```bash
sudo systemctl enable filebrowser
sudo systemctl start filebrowser
```

### Docker Compose

For a more robust Docker setup, you can use Docker Compose. Create a `docker-compose.yml` file:

```yaml
version: '3.3'
services:
  filebrowser:
    image: matindehghanian/filebrowser
    container_name: filebrowser
    volumes:
      - /path/to/your/files:/srv
      - /path/to/your/database.db:/database.db
      - /path/to/your/.filebrowser.json:/.filebrowser.json
    ports:
      - 8080:80
    restart: unless-stopped
```

Then, start the container with:

```bash
docker-compose up -d
```

## Project Status

This project is actively maintained. If you encounter any bugs, please open an issue.

## Contributing

Contributions are always welcome. To start contributing to this project, read our [guidelines](CONTRIBUTING.md) first.

## License

[Apache License 2.0](LICENSE) © Matin Dehghanian
