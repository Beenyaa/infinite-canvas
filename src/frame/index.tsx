import styles from "./style.module.css";

export function Frame() {
    return (
        <header className={`frame ${styles.frame}`}>
            <h1 className={styles.frame__title}>Infinite Canvas</h1>
            <a className={styles.frame__github} href="https://github.com/beenyaa/infinite-canvas">
                GitHub
            </a>
            <div className={styles.frame__credits}>
                <span>By </span>
                <a href="https://www.bence.codes/">Bence Gadányi</a>
            </div>

            <nav className={styles.frame__tags}>
                <a href="#">#infinite</a>
                <a href="#">#scroll</a>
                <a href="#">#draggable</a>
                <a href="#">#html5-canvas</a>
            </nav>
        </header>
    );
}
