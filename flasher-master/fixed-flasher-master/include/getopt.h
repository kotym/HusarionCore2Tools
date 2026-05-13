#ifndef FLASHER_GETOPT_H
#define FLASHER_GETOPT_H

#ifdef __cplusplus
extern "C" {
#endif

enum
{
	no_argument = 0,
	required_argument = 1,
	optional_argument = 2
};

struct option
{
	const char* name;
	int has_arg;
	int* flag;
	int val;
};

static char* optarg = 0;
static int optind = 1;
static int opterr = 1;
static int optopt = 0;

static int flasher_getopt_next_char = 0;

static int getopt_long(int argc, char* const argv[], const char* optstring, const struct option* longopts, int* longindex)
{
	if (longindex)
	{
		*longindex = -1;
	}

	if (optind >= argc)
	{
		return -1;
	}

	char* current = argv[optind];
	if (!current)
	{
		return -1;
	}

	if (flasher_getopt_next_char == 0)
	{
		if (current[0] != '-' || current[1] == '\0')
		{
			return -1;
		}

		if (current[1] == '-' && current[2] == '\0')
		{
			optind++;
			return -1;
		}

		if (current[1] == '-')
		{
			const char* name = current + 2;
			const char* value = 0;
			const char* eq = name;
			while (*eq && *eq != '=')
			{
				++eq;
			}
			if (*eq == '=')
			{
				value = eq + 1;
			}

			int matchIndex = -1;
			if (longopts)
			{
				for (int i = 0; longopts[i].name != 0; ++i)
				{
					const char* candidate = longopts[i].name;
					const size_t len = (size_t)(eq - name);
					if (strncmp(candidate, name, len) == 0 && candidate[len] == '\0')
					{
						matchIndex = i;
						break;
					}
				}
			}

			if (matchIndex < 0)
			{
				optopt = 0;
				optind++;
				return '?';
			}

			const struct option* opt = &longopts[matchIndex];
			if (longindex)
			{
				*longindex = matchIndex;
			}

			if (opt->has_arg == required_argument)
			{
				if (!value)
				{
					if (optind + 1 >= argc)
					{
						optind++;
						return ':';
					}
					value = argv[++optind];
				}
				optarg = const_cast<char*>(value);
			}
			else if (opt->has_arg == optional_argument)
			{
				optarg = value ? const_cast<char*>(value) : 0;
			}
			else
			{
				optarg = 0;
			}

			optind++;
			if (opt->flag)
			{
				*(opt->flag) = opt->val;
				return 0;
			}
			return opt->val;
		}

		flasher_getopt_next_char = 1;
	}

	char c = current[flasher_getopt_next_char++];
	const char* found = strchr(optstring, c);
	if (!found)
	{
		optopt = c;
		if (current[flasher_getopt_next_char] == '\0')
		{
			optind++;
			flasher_getopt_next_char = 0;
		}
		return '?';
	}

	if (found[1] == ':')
	{
		if (current[flasher_getopt_next_char] != '\0')
		{
			optarg = &current[flasher_getopt_next_char];
			optind++;
			flasher_getopt_next_char = 0;
		}
		else if (optind + 1 < argc)
		{
			optarg = argv[++optind];
			optind++;
			flasher_getopt_next_char = 0;
		}
		else
		{
			optopt = c;
			optind++;
			flasher_getopt_next_char = 0;
			return ':';
		}
	}
	else
	{
		optarg = 0;
		if (current[flasher_getopt_next_char] == '\0')
		{
			optind++;
			flasher_getopt_next_char = 0;
		}
	}

	return c;
}

#ifdef __cplusplus
}
#endif

#endif