use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub enum VdfValue {
    String(String),
    Object(HashMap<String, VdfValue>),
}

impl VdfValue {
    pub fn get_str(&self, key: &str) -> Option<&str> {
        match self {
            VdfValue::Object(map) => {
                // Check exact match or case-insensitive match
                map.get(key)
                    .or_else(|| map.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v))
                    .and_then(|v| match v {
                        VdfValue::String(s) => Some(s.as_str()),
                        _ => None,
                    })
            }
            _ => None,
        }
    }

    pub fn get_obj(&self, key: &str) -> Option<&HashMap<String, VdfValue>> {
        match self {
            VdfValue::Object(map) => {
                map.get(key)
                    .or_else(|| map.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v))
                    .and_then(|v| match v {
                        VdfValue::Object(o) => Some(o),
                        _ => None,
                    })
            }
            _ => None,
        }
    }
}

pub struct VdfParser<'a> {
    chars: std::iter::Peekable<std::str::Chars<'a>>,
}

impl<'a> VdfParser<'a> {
    pub fn parse(input: &'a str) -> HashMap<String, VdfValue> {
        let mut parser = Self {
            chars: input.chars().peekable(),
        };
        parser.parse_object_body(false)
    }

    fn skip_whitespace_and_comments(&mut self) {
        while let Some(&c) = self.chars.peek() {
            if c.is_whitespace() {
                self.chars.next();
            } else if c == '/' {
                self.chars.next();
                if let Some(&next) = self.chars.peek() {
                    if next == '/' {
                        // Skip till end of line
                        while let Some(ch) = self.chars.next() {
                            if ch == '\n' {
                                break;
                            }
                        }
                    } else {
                        break;
                    }
                }
            } else {
                break;
            }
        }
    }

    fn parse_string(&mut self) -> Option<String> {
        self.skip_whitespace_and_comments();
        let first = self.chars.next()?;
        if first == '"' {
            let mut s = String::new();
            let mut escape = false;
            while let Some(c) = self.chars.next() {
                if escape {
                    s.push(c);
                    escape = false;
                } else if c == '\\' {
                    escape = true;
                } else if c == '"' {
                    return Some(s);
                } else {
                    s.push(c);
                }
            }
            Some(s)
        } else {
            // Unquoted string/token
            let mut s = String::new();
            s.push(first);
            while let Some(&c) = self.chars.peek() {
                if c.is_whitespace() || c == '{' || c == '}' || c == '"' {
                    break;
                }
                s.push(self.chars.next().unwrap());
            }
            Some(s)
        }
    }

    fn parse_object_body(&mut self, stop_at_closing_brace: bool) -> HashMap<String, VdfValue> {
        let mut map = HashMap::new();

        loop {
            self.skip_whitespace_and_comments();
            let &peeked = match self.chars.peek() {
                Some(p) => p,
                None => break,
            };

            if stop_at_closing_brace && peeked == '}' {
                self.chars.next();
                break;
            }

            let key = match self.parse_string() {
                Some(k) => k,
                None => break,
            };

            self.skip_whitespace_and_comments();
            match self.chars.peek() {
                Some(&'{') => {
                    self.chars.next();
                    let child_obj = self.parse_object_body(true);
                    map.insert(key, VdfValue::Object(child_obj));
                }
                Some(&'}') => {
                    // unexpected closing brace
                    if stop_at_closing_brace {
                        self.chars.next();
                        break;
                    }
                }
                _ => {
                    if let Some(val_str) = self.parse_string() {
                        map.insert(key, VdfValue::String(val_str));
                    }
                }
            }
        }

        map
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_manifest() {
        let vdf_text = r#"
        "AppState"
        {
            "appid"        "730"
            "name"         "Counter-Strike 2"
            "installdir"   "Counter-Strike Global Offensive"
            "buildid"      "12345"
            "MountedDepots"
            {
                "731"      "999888777"
                "732"      "111222333"
            }
        }
        "#;
        let parsed = VdfParser::parse(vdf_text);
        assert!(parsed.contains_key("AppState"));
        let app_state = parsed.get("AppState").unwrap();
        assert_eq!(app_state.get_str("appid"), Some("730"));
        assert_eq!(app_state.get_str("name"), Some("Counter-Strike 2"));

        let depots = app_state.get_obj("MountedDepots").unwrap();
        assert_eq!(depots.len(), 2);
    }

    #[test]
    fn test_parse_installed_depots() {
        let vdf_text = r#"
        "AppState"
        {
            "appid"        "730"
            "name"         "Counter-Strike 2"
            "InstalledDepots"
            {
                "731"
                {
                    "manifest"    "5820194820194820"
                    "size"        "35000000000"
                }
                "732"
                {
                    "manifest"    "1928374650192834"
                    "size"        "1000000"
                }
            }
        }
        "#;
        let parsed = VdfParser::parse(vdf_text);
        let app_state = parsed.get("AppState").unwrap();
        let depots = app_state.get_obj("InstalledDepots").unwrap();
        assert_eq!(depots.len(), 2);
        let d731 = depots.get("731").unwrap();
        assert_eq!(d731.get_str("manifest"), Some("5820194820194820"));
    }
}

