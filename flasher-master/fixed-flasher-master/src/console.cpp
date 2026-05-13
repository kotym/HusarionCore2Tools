#include "console.h"

#include <stdio.h>
#include "myFTDI.h"
#include <stdlib.h>

#ifdef UNIX
#include <unistd.h>
#include <termios.h>
#include <signal.h>
#include <thread>
#include <pthread.h>
#include <sys/time.h>
#elif WIN32
#include "mingw.thread.h"
#include <windows.h>
#include <conio.h>
#endif

static bool stop = false;

void sigHandler(int num)
{
	(void)num;
	stop = true;
}

#ifdef WIN32
BOOL WINAPI consoleCtrlHandler(DWORD ctrlType)
{
	if (ctrlType == CTRL_C_EVENT || ctrlType == CTRL_BREAK_EVENT || ctrlType == CTRL_CLOSE_EVENT)
	{
		stop = true;
		return TRUE;
	}
	return FALSE;
}
#endif

void thread()
{
#ifdef UNIX
	struct termios oldt, newt;
	tcgetattr(fileno(stdin), &oldt);
	newt = oldt;
	newt.c_lflag &= ~(ICANON | ECHO);
	tcsetattr(fileno(stdin), TCSANOW, &newt);
#elif WIN32
	HANDLE hStdin = GetStdHandle(STD_INPUT_HANDLE);
	DWORD mode = 0;
	bool canRestoreMode = GetConsoleMode(hStdin, &mode) != 0;
	if (canRestoreMode)
	{
		SetConsoleMode(hStdin, mode & (~ENABLE_ECHO_INPUT));
	}
#endif

	while (!stop)
	{
#ifdef UNIX
		fd_set set;
		struct timeval tv;

		tv.tv_sec = 0;
		tv.tv_usec = 1000 * 1000;

		FD_ZERO(&set);
		FD_SET(fileno(stdin), &set);

		int res = select(fileno(stdin) + 1, &set, NULL, NULL, &tv);

		if (res > 0)
		{
			char data[100];
			int r = read(fileno(stdin), data, 100);
			uart_tx(data, r);
		}
#elif WIN32
		if (_kbhit())
		{
			char data[100];
			int count = 0;
			while (_kbhit() && count < (int)sizeof(data))
			{
				int ch = _getch();
				if (ch == 0 || ch == 224)
				{
					if (_kbhit())
						(void)_getch();
					continue;
				}
				data[count++] = (char)ch;
			}
			if (count > 0)
			{
				uart_tx(data, count);
			}
		}
		else
		{
			Sleep(10);
		}
#endif
	}

#ifdef UNIX
	tcsetattr(fileno(stdin), TCSANOW, &oldt);
#elif WIN32
	if (canRestoreMode)
	{
		SetConsoleMode(hStdin, mode | ENABLE_ECHO_INPUT);
	}
#endif
}

int runConsole(int speed)
{
	bool res = uart_open(speed, true);
	if (!res)
		return 1;

	stop = false;
#ifdef UNIX
	signal(SIGINT, &sigHandler);
#elif WIN32
	SetConsoleCtrlHandler(consoleCtrlHandler, TRUE);
#endif

	std::thread th(thread);

	while (!stop)
	{
		int res;
		char data[1024];
		res = uart_rx_any(data, 1024);
		if (res == -1) {
			exit(1);
		}
		if (res)
		{
			for (int i = 0; i < res; i++)
				putchar(data[i]);
		}
	}

	th.join();

	uart_close();

#ifdef WIN32
	SetConsoleCtrlHandler(consoleCtrlHandler, FALSE);
#endif

	return 0;
}

