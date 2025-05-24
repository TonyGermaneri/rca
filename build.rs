fn main() {
    println!("cargo:rustc-env=RCA_VERSION={}", env!("CARGO_PKG_VERSION"));
    if let Ok(git_hash) = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
    {
        let hash = String::from_utf8_lossy(&git_hash.stdout);
        println!("cargo:rustc-env=GIT_COMMIT_HASH={}", hash.trim());
    }
}
